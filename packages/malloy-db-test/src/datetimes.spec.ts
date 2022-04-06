/* eslint-disable no-console */
/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import { Result } from "@malloydata/malloy";
import { RuntimeList } from "./runtimes";

// No prebuilt shared model, each test is complete.  Makes debugging easier.

const dialects = [
  "bigquery", //
  "postgres", //
];

type DialectNames = typeof dialects[number];

const runtimes = new RuntimeList(dialects);

afterAll(async () => {
  await runtimes.closeAll();
});

const basicTypes: Record<DialectNames, string> = {
  bigquery: `
    SELECT * FROM UNNEST([STRUCT(
      CAST('2021-02-24' as DATE) as t_date,
      CAST('2021-02-24 03:05:06' as TIMESTAMP) as t_timestamp
    )])`,
  postgres: `
    SELECT
      DATE('2021-02-24') as t_date,
      '2021-02-24 03:05:06':: timestamp with time zone as t_timestamp
  `,
};

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  it(`sql_block no explore- ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: basicTypes is || ${basicTypes[databaseName]} ;;

      query: from_sql(basicTypes) -> {
        project:
          t_date
          t_timestamp
      }
      `
      )
      .run();
    // console.log(result.sql);
    expect(result.data.path(0, "t_date").value).toEqual(new Date("2021-02-24"));
    expect(result.data.path(0, "t_timestamp").value).toEqual(
      new Date("2021-02-24T03:05:06.000Z")
    );
  });

  it(`dates and timestamps - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: basicTypes is || ${basicTypes[databaseName]} ;;

      query: from_sql(basicTypes) -> {
        aggregate:
          d1 is count() { where: t_date: @2021-02-24} = 1
          d2 is count() { where: t_date: @2021-02-23 for 2 days} = 1
          // d3 is count() { where: t_date: @2021-02-23 00:00 for 2 days} = 1



          t1 is count() { where: t_timestamp: @2021-02-24} = 1
          // t2 is count() { where: t_timestamp: @2021-02-23 for 2 days} = 1
          t3 is count() { where: t_timestamp: @2021-02-23 00:00:00 for 2 days} = 1
      }
      `
      )
      .run();
    // console.log(result.sql);

    result.resultExplore.allFields.forEach((field) => {
      expect(`${result.data.path(0, field.name).value} ${field.name}`).toBe(
        `true ${field.name}`
      );
    });
  });

  it(`Run Test Here - ${databaseName}`, async () => {
    const result = await runtime
      .loadQuery(
        `
      sql: basicTypes is || ${basicTypes[databaseName]} ;;

      query: from_sql(basicTypes) -> {
        aggregate:
          works is count() = 1

          // this is actually not working quite right, needs to be a date comparison, not a
          //  time comparison or an error...
          // d3 is count() { where: t_date: @2021-02-23 00:00 for 2 days} = 1

          // the end of the range is a date which can't be casted to a timezone.
          // t2 is count() { where: t_timestamp: @2021-02-23 for 2 days} = 1
      }
      `
      )
      .run();
    // console.log(result.sql);

    result.resultExplore.allFields.forEach((field) => {
      expect(`${result.data.path(0, field.name).value} ${field.name}`).toBe(
        `true ${field.name}`
      );
    });
  });

  describe(`time difference - ${databaseName}`, () => {
    const loggingSql = false;

    async function goCalc(diffExpr: string) {
      return await runtime
        .loadQuery(
          `
            sql: nothing is || SELECT NULL as nothing;;
            query: from_sql(nothing) -> { project: calc is (${diffExpr}) }
          `
        )
        .run();
    }
    function calc(result: Result, log = false) {
      if (loggingSql || log) {
        console.log(result.sql);
      }
      return result.data.path(0, "calc").value;
    }

    // discovered this writing tests ...
    test("valid timestamp without seconds", async () => {
      const result = await goCalc("year(@2000-01-01 00:00)");
      expect(calc(result)).toBe(2000);
    });

    test("forwards is positive", async () => {
      const result = await goCalc(
        "day(@2000-01-01 00:00:00 to @2000-01-02 00:00:00)"
      );
      expect(calc(result)).toBe(1);
    });
    test("reverse is negative", async () => {
      const result = await goCalc(
        "day(@2000-01-02 00:00:00 to @2000-01-01 00:00:00)"
      );
      expect(calc(result)).toBe(-1);
    });

    test("DATE to TIMESTAMP", async () => {
      const result = await goCalc("day((@1999)::date to @2000-01-01 00:00:00)");
      expect(calc(result)).toBe(365);
    });

    test("TIMESTAMP to DATE", async () => {
      const result = await goCalc(
        "month(@2000-01-01 00:00:00 to (@1999)::date)"
      );
      expect(calc(result)).toBe(-12);
    });

    test("seconds", async () => {
      const result = await goCalc(
        "seconds(@2001-01-01 00:00:00 to @2001-01-01 00:00:42)"
      );
      expect(calc(result)).toBe(42);
    });

    test("many seconds", async () => {
      const result = await goCalc(
        "seconds(@2001-01-01 00:00:00 to @2001-01-02 00:00:42)"
      );
      expect(calc(result)).toBe(86442);
    });

    test("minutes", async () => {
      const result = await goCalc(
        "minutes(@2001-01-01 00:00:00 to @2001-01-01 00:42:00)"
      );
      expect(calc(result)).toBe(42);
    });

    test("many minutes", async () => {
      const result = await goCalc(
        "minutes(@2001-01-01 00:00:00 to @2001-01-02 00:42:00)"
      );
      expect(calc(result)).toBe(1482);
    });

    test("hours", async () => {
      const result = await goCalc(
        "hours(@2001-01-01 00:00:00 to @2001-01-02 18:00:00)"
      );
      expect(calc(result)).toBe(42);
    });

    test("days", async () => {
      const result = await goCalc("days(@2001-01-01 to @2001-02-12)");
      expect(calc(result)).toBe(42);
    });

    test("weeks", async () => {
      const result = await goCalc("weeks(@2001-01-01 to @2001-10-27)");
      expect(calc(result)).toBe(42);
    });

    test("quarters", async () => {
      const result = await goCalc("quarters(@2001-01-01 to @2011-09-30)");
      expect(calc(result)).toBe(42);
    });

    test("months", async () => {
      const result = await goCalc("months(@2000-01-01 to @2003-07-01)");
      expect(calc(result, true)).toBe(42);
    });

    test("years", async () => {
      const result = await goCalc("year(@2000 to @2042)");
      expect(calc(result)).toBe(42);
    });
  });
});
