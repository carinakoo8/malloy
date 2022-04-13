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
  async function sqlEq(expr: string, result: string) {
    return await runtime
      .loadQuery(
        `
          sql: basicTypes is || ${basicTypes[databaseName]} ;;
          query:
            from_sql(basicTypes) {
              dimension:
                expect is ${result}
                got is ${expr}
            }
            -> {
              project: calc is
                pick '=' when expect = got
                else concat('${expr} != ${result}. Got: ', got::string)
            }
        `
      )
      .run();
  }

  function checkEqual(result: Result, log = false) {
    let wantEq = result.data.path(0, "calc").value;
    if (wantEq != "=") {
      wantEq = wantEq + "\nSQL: " + result.sql;
    }
    return wantEq;
  }

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

  describe("time operations", () => {
    test(`valid timestamp without seconds - ${databaseName}`, async () => {
      // discovered this writing tests ...
      const result = await sqlEq("year(@2000-01-01 00:00)", "2000");
      expect(checkEqual(result)).toBe("=");
    });
    describe(`time difference - ${databaseName}`, () => {
      test("forwards is positive", async () => {
        const result = await sqlEq("day(@2000-01-01 to @2000-01-02)", "1");
        expect(checkEqual(result)).toBe("=");
      });
      test("reverse is negative", async () => {
        const result = await sqlEq("day(@2000-01-02 to @2000-01-01)", "-1");
        expect(checkEqual(result)).toBe("=");
      });
      test("DATE to TIMESTAMP", async () => {
        const result = await sqlEq(
          "day((@1999)::date to @2000-01-01 00:00:00)",
          "365"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("TIMESTAMP to DATE", async () => {
        const result = await sqlEq(
          "month(@2000-01-01 to (@1999)::date)",
          "-12"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("seconds", async () => {
        const result = await sqlEq(
          "seconds(@2001-01-01 00:00:00 to @2001-01-01 00:00:42)",
          "42"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("many seconds", async () => {
        const result = await sqlEq(
          "seconds(@2001-01-01 00:00:00 to @2001-01-02 00:00:42)",
          "86442"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("minutes", async () => {
        const result = await sqlEq(
          "minutes(@2001-01-01 00:00:00 to @2001-01-01 00:42:00)",
          "42"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("many minutes", async () => {
        const result = await sqlEq(
          "minutes(@2001-01-01 00:00:00 to @2001-01-02 00:42:00)",
          "1482"
        );
        expect(checkEqual(result)).toBe("=");
      });

      test("hours", async () => {
        const result = await sqlEq(
          "hours(@2001-01-01 00:00:00 to @2001-01-02 18:00:00)",
          "42"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("days", async () => {
        const result = await sqlEq("days(@2001-01-01 to @2001-02-12)", "42");
        expect(checkEqual(result)).toBe("=");
      });
      test("weeks", async () => {
        const result = await sqlEq("weeks(@2001-01-01 to @2001-10-27)", "42");
        expect(checkEqual(result)).toBe("=");
      });
      test("quarters", async () => {
        const result = await sqlEq(
          "quarters(@2001-01-01 to @2011-09-30)",
          "42"
        );
        expect(checkEqual(result)).toBe("=");
      });
      test("months", async () => {
        const result = await sqlEq("months(@2000-01-01 to @2003-07-01)", "42");
        expect(checkEqual(result, true)).toBe("=");
      });
      test("years", async () => {
        const result = await sqlEq("year(@2000 to @2042)", "42");
        expect(checkEqual(result)).toBe("=");
      });
    });

    describe(`timestamp truncation - ${databaseName}`, () => {
      // 2021-02-24 03:05:06
      test(`trunc second - ${databaseName}`, async () => {
        const result = await sqlEq(
          "t_timestamp.second",
          "@2021-02-24 03:05:06"
        );
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc minute - ${databaseName}`, async () => {
        const result = await sqlEq(
          "t_timestamp.minute",
          "@2021-02-24 03:05:00"
        );
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc hour - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.hour", "@2021-02-24 03:00:00");
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc day - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.day", "@2021-02-24 00:00:00");
        expect(checkEqual(result)).toBe("=");
      });

      test.skip(`trunc week - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.week", "@2021-02-21");
        expect(checkEqual(result)).toBe("=");
      });

      test(`trunc month - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.month", "@2021-02-01 00:00:00");
        expect(checkEqual(result)).toBe("=");
      });

      test.skip(`trunc quarter - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.quarter", "@2021-01-01");
        expect(checkEqual(result)).toBe("=");
      });

      test.skip(`trunc year - ${databaseName}`, async () => {
        const result = await sqlEq("t_timestamp.year", "@2021");
        expect(checkEqual(result)).toBe("=");
      });
    });

    describe(`timestamp extraction - ${databaseName}`, () => {
      // 2021-02-24 03:05:06
      test(`extract second - ${databaseName}`, async () => {
        const result = await sqlEq("second(t_timestamp)", "6");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract minute - ${databaseName}`, async () => {
        const result = await sqlEq("minute(t_timestamp)", "5");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract hour - ${databaseName}`, async () => {
        const result = await sqlEq("hour(t_timestamp)", "3");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract day - ${databaseName}`, async () => {
        const result = await sqlEq("day(t_timestamp)", "24");
        expect(checkEqual(result)).toBe("=");
      });
      test.skip(`extract day_of_week - ${databaseName}`, async () => {
        const result = await sqlEq("day_of_week(t_timestamp)", "4");
        expect(checkEqual(result)).toBe("=");
      });
      test.skip(`extract day_of_year - ${databaseName}`, async () => {
        const result = await sqlEq("day_of_year(t_timestamp)", "55");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract week - ${databaseName}`, async () => {
        const result = await sqlEq("week(t_timestamp)", "8");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract month - ${databaseName}`, async () => {
        const result = await sqlEq("month(t_timestamp)", "2");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract quarter - ${databaseName}`, async () => {
        const result = await sqlEq("quarter(t_timestamp)", "1");
        expect(checkEqual(result)).toBe("=");
      });
      test(`extract year - ${databaseName}`, async () => {
        const result = await sqlEq("year(t_timestamp)", "2021");
        expect(checkEqual(result)).toBe("=");
      });
    });

    describe(`date truncation - ${databaseName}`, () => {
      test(`date trunc day - ${databaseName}`, async () => {
        const result = await sqlEq("t_date.day", "@2021-02-24");
        expect(checkEqual(result)).toBe("=");
      });

      test.skip(`date trunc week - ${databaseName}`, async () => {
        const result = await sqlEq("t_date.week", "@2021-02-21");
        expect(checkEqual(result)).toBe("=");
      });

      test(`date trunc month - ${databaseName}`, async () => {
        const result = await sqlEq("t_date.month", "@2021-02-01");
        expect(checkEqual(result)).toBe("=");
      });

      test(`date trunc quarter - ${databaseName}`, async () => {
        const result = await sqlEq("t_date.quarter", "@2021-01-01");
        expect(checkEqual(result)).toBe("=");
      });

      test(`date trunc year - ${databaseName}`, async () => {
        const result = await sqlEq("t_date.year", "@2021");
        expect(checkEqual(result)).toBe("=");
      });
    });

    describe(`date extraction - ${databaseName}`, () => {
      test(`date extract day - ${databaseName}`, async () => {
        const result = await sqlEq("day(t_date)", "24");
        expect(checkEqual(result)).toBe("=");
      });
      test.skip(`date extract day_of_week - ${databaseName}`, async () => {
        const result = await sqlEq("day_of_week(t_date)", "4");
        expect(checkEqual(result)).toBe("=");
      });
      test.skip(`date extract day_of_year - ${databaseName}`, async () => {
        const result = await sqlEq("day_of_year(t_date)", "55");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date extract week - ${databaseName}`, async () => {
        const result = await sqlEq("week(t_date)", "8");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date extract month - ${databaseName}`, async () => {
        const result = await sqlEq("month(t_date)", "2");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date extract quarter - ${databaseName}`, async () => {
        const result = await sqlEq("quarter(t_date)", "1");
        expect(checkEqual(result)).toBe("=");
      });
      test(`date extract year - ${databaseName}`, async () => {
        const result = await sqlEq("year(t_date)", "2021");
        expect(checkEqual(result)).toBe("=");
      });
    });
  });
});
