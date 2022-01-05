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

import { test } from "@jest/globals";
import { testModel } from "./models/faa_model";
import { fStringEq } from "./test_utils";

import "@malloy-lang/malloy/src/lang/jestery";

import { BigQueryConnection } from "@malloy-lang/db-bigquery";
import * as malloy from "@malloy-lang/malloy";
import * as util from "util";
import * as fs from "fs";
import { Query } from "@malloy-lang/malloy";

const bq = new BigQueryConnection("test");
const files = {
  readURL: async (url: malloy.URL) => {
    const filePath = url.toString().replace(/^file:\/\//, "");
    return await util.promisify(fs.readFile)(filePath, "utf8");
  },
};
const runtime = new malloy.Runtime(files, bq);

function compileQueryFromQueryDef(
  model: malloy.ModelMaterializer,
  query: Query
) {
  return model._loadQueryFromQueryDef(query).getSQL();
}

async function compileQuery(model: malloy.ModelMaterializer, query: string) {
  return await model.loadQuery(query).getSQL();
}

async function runQuery(model: malloy.ModelMaterializer, query: string) {
  return await model.loadQuery(query).run();
}

async function bqCompile(sql: string): Promise<boolean> {
  try {
    await bq.executeSQLRaw(`WITH test AS(\n${sql}) SELECT 1`);
  } catch (e) {
    malloy.Malloy.log.error(`SQL: didn't compile\n=============\n${sql}`);
    throw e;
  }
  return true;
}

describe("expression tests", () => {
  const faa = runtime._loadModelFromModelDef(testModel);

  it("simple_pipeline", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeHead: { name: "flights_by_carrier" },
      pipeline: [{ fields: ["name", "flight_count"], type: "reduce" }],
    });
    await bqCompile(sql);
  });

  // EXPLORE flights
  //   | REDUCE
  //       carrier,
  //       flight_count,
  //       routes is (REDUCE origin_code, destination_code, route_flights is flight_count
  //         ORDER BY route_flights DESC
  //         LIMIT 5 )
  //   | PROJECT
  //       carrier,
  //       routes.origin_code,
  //       routes.route_flights,
  //         flight_count / routes.route_flights as percent_of_carrier_flights
  it("turtle_requery", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeline: [
        // top 5 routes per carrier
        {
          type: "reduce",
          fields: [
            "carrier",
            "flight_count",
            {
              type: "turtle",
              name: "routes",
              pipeline: [
                {
                  type: "reduce",
                  fields: [
                    "origin_code",
                    "destination_code",
                    "flight_count",
                    { as: "route_flights", name: "flight_count" },
                  ],
                },
              ],
            },
          ],
          limit: 5,
          orderBy: [{ dir: "desc", field: "carrier" }],
        },
        // carrier top routes
        {
          type: "project",
          fields: [
            "carrier",
            "flight_count",
            "routes.origin_code",
            "routes.route_flights",
          ],
        },
      ],
    });
    await bqCompile(sql);
  });

  it("step_0", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeline: [{ type: "reduce", fields: ["carriers.name", "flight_count"] }],
    });
    await bqCompile(sql);
  });

  it("filtered_measures", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      filterList: [
        fStringEq("origin.state", "CA"),
        fStringEq("destination.state", "NY"),
      ],
      pipeline: [{ type: "reduce", fields: ["carriers.name", "flight_count"] }],
    });
    await bqCompile(sql);
  });

  it("timestamp", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeline: [
        {
          fields: [
            {
              as: "dep_year",
              name: "dep_time",
              timeframe: "year",
              type: "timestamp",
            },
            {
              as: "dep_month",
              name: "dep_time",
              timeframe: "month",
              type: "timestamp",
            },
            {
              as: "dep_week",
              name: "dep_time",
              timeframe: "week",
              type: "timestamp",
            },
            {
              as: "dep_date",
              name: "dep_time",
              timeframe: "date",
              type: "timestamp",
            },
            {
              as: "dep_hour",
              name: "dep_time",
              timeframe: "hour",
              type: "timestamp",
            },
            {
              as: "dep_minute",
              name: "dep_time",
              timeframe: "minute",
              type: "timestamp",
            },
            {
              as: "dep_second",
              name: "dep_time",
              timeframe: "second",
              type: "timestamp",
            },
            {
              type: "number",
              name: "total_distance_ca",
              aggregate: true,
              e: [
                {
                  type: "filterExpression",
                  filterList: [fStringEq("origin.state", "CA")],
                  e: [
                    {
                      type: "aggregate",
                      function: "sum",
                      e: [{ type: "field", path: "distance" }],
                    },
                  ],
                },
              ],
            },
          ],
          limit: 20,
          type: "reduce",
        },
      ],
    });
    await bqCompile(sql);
  });

  it("bucket_test", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      pipeline: [
        {
          fields: [
            {
              bucketFilter: "AA,WN,DL",
              bucketOther: "Other Carrier",
              name: "carrier",
              type: "string",
            },
            "flight_count",
          ],
          orderBy: [{ dir: "asc", field: 2 }],
          type: "reduce",
        },
      ],
      structRef: "flights",
    });
    await bqCompile(sql);
  });

  it("flights_by_carrier", async () => {
    const sql = await compileQuery(faa, "EXPLORE flights | flights_by_carrier");
    await bqCompile(sql);
  });

  it("simple_reduce", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeline: [{ type: "reduce", fields: ["carrier", "flight_count"] }],
    });
    await bqCompile(sql);
  });

  it("two_sums", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeline: [
        {
          type: "reduce",
          fields: [
            {
              type: "number",
              aggregate: true,
              name: "total_distance",
              e: [
                {
                  type: "aggregate",
                  function: "sum",
                  e: [{ type: "field", path: "distance" }],
                },
              ],
            },
            "aircraft.aircraft_models.total_seats",
          ],
        },
      ],
    });
    await bqCompile(sql);
  });

  it("first_fragment", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeline: [
        {
          type: "reduce",
          fields: [
            {
              type: "string",
              name: "carrier",
              e: ["UPPER(", { type: "field", path: "carriers.nickname" }, ")"],
            },
            "flight_count",
          ],
        },
      ],
    });
    await bqCompile(sql);
  });

  it("sum_in_expr", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeline: [
        {
          fields: [
            "carriers.name",
            {
              type: "number",
              aggregate: true,
              name: "total_distance",
              e: [
                {
                  type: "aggregate",
                  function: "sum",
                  e: [{ type: "field", path: "distance" }],
                },
              ],
            },
          ],
          type: "reduce",
        },
      ],
    });
    await bqCompile(sql);
  });

  it("filtered_sum_in_expr", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeline: [
        {
          type: "reduce",
          fields: [
            "aircraft.aircraft_models.manufacturer",
            {
              type: "number",
              aggregate: true,
              name: "total_distance",
              e: [
                {
                  type: "filterExpression",
                  filterList: [fStringEq("origin_code", "SFO")],
                  e: [
                    {
                      type: "aggregate",
                      function: "sum",
                      e: [{ type: "field", path: "distance" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    await bqCompile(sql);
  });

  it("dynamic_measure", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeline: [
        {
          type: "reduce",
          fields: [
            "origin.state",
            "flight_count",
            {
              type: "number",
              aggregate: true,
              name: "total_distance",
              e: [
                {
                  type: "filterExpression",
                  filterList: [fStringEq("origin_code", "SFO")],
                  e: [
                    {
                      type: "aggregate",
                      function: "sum",
                      e: [{ type: "field", path: "distance" }],
                    },
                  ],
                },
              ],
            },
          ],
          filterList: [fStringEq("carriers.code", "WN")],
        },
      ],
    });
    await bqCompile(sql);
  });

  it("add_filter_to_named_query", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      filterList: [fStringEq("destination_code", "AL")],
      pipeHead: { name: "flights_by_city_top_5" },
      pipeline: [],
    });
    await bqCompile(sql);
  });

  it("flights.flights_by_model", async () => {
    const sql = await compileQuery(faa, "EXPLORE flights | flights_by_model");
    await bqCompile(sql);
  });

  it("flights.aircraft_facts_test", async () => {
    const sql = await compileQuery(
      faa,
      "EXPLORE flights | aircraft_facts_test"
    );
    await bqCompile(sql);
  });

  it("flights.measures_first", async () => {
    const sql = await compileQuery(faa, "EXPLORE flights | measures_first");
    await bqCompile(sql);
  });

  it("flights.carriers_by_total_engines", async () => {
    const sql = await compileQuery(
      faa,
      "EXPLORE flights | carriers_by_total_engines"
    );
    await bqCompile(sql);
  });

  it("flights.first_turtle", async () => {
    const sql = await compileQuery(faa, "EXPLORE flights | first_turtle");
    await bqCompile(sql);
  });

  it("flights.top_5_routes_carriers", async () => {
    const sql = await compileQuery(
      faa,
      "EXPLORE flights | top_5_routes_carriers"
    );
    await bqCompile(sql);
  });

  it("flights.new_york_airports", async () => {
    const sql = await compileQuery(faa, "EXPLORE flights | new_york_airports");
    await bqCompile(sql);
  });

  it("flights.flights_by_carrier_with_totals", async () => {
    const sql = await compileQuery(
      faa,
      "EXPLORE flights | flights_by_carrier_with_totals"
    );
    await bqCompile(sql);
  });

  it("lotsoturtles", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      pipeline: [
        {
          fields: [
            "origin.state",
            "flight_count",
            "flights_by_model",
            "flights_by_carrier",
            "measures_first",
            "first_turtle",
          ],
          type: "reduce",
        },
      ],
    });
    await bqCompile(sql);
  });

  it("add_filter_to_def", async () => {
    const sql = await compileQueryFromQueryDef(faa, {
      structRef: "flights",
      filterList: [fStringEq("destination_code", "AL")],
      pipeHead: { name: "flights_by_carrier_with_totals" },
      pipeline: [
        {
          type: "reduce",
          fields: [
            "main.name",
            "main.flight_count",
            { as: "total_flights", name: "totals.flight_count" },
          ],
        },
      ],
    });
    await bqCompile(sql);
  });

  it("flights.search_index", async () => {
    const sql = await compileQuery(faa, "EXPLORE flights | search_index");
    await bqCompile(sql);
  });

  it("turtle_turtle_filter", async () => {
    const result = await runQuery(
      faa,
      `
    explore table_airports : [faa_region:'AEA'|'AGL']| reduce order by 1
      faa_region,
      airport_count is COUNT(*),
      state is (REDUCE : [state:'CA'|'NY']
        state,
        code is ( REDUCE : [major:'Y'] top 10 order by 1
          code
        )
      )
    | PROJECT state.code.code LIMIT 1
    `
    );
    expect(result.data.value[0].code).toBe("ALB");
  });

  it("flights.search_index", async () => {
    const sql = await compileQuery(faa, "EXPLORE flights | search_index");
    await bqCompile(sql);
  });

  it("medicare_test.turtle_city_zip", async () => {
    const sql = await compileQuery(
      faa,
      "EXPLORE medicare_test | turtle_city_zip"
    );
    await bqCompile(sql);
  });

  it("medicare_test.triple_turtle", async () => {
    const sql = await compileQuery(
      faa,
      "EXPLORE medicare_test | triple_turtle"
    );
    await bqCompile(sql);
  });

  it("medicare_test.rollup_by_location", async () => {
    const sql = await compileQuery(
      faa,
      "explore medicare_test | rollup_by_location"
    );
    await bqCompile(sql);
  });

  it("flights.flights_routes_sessionized", async () => {
    const sql = await compileQuery(
      faa,
      "EXPLORE flights | flights_routes_sessionized"
    );
    await bqCompile(sql);
  });

  it("flights.flights_aircraft_sessionized", async () => {
    const sql = await compileQuery(
      faa,
      "EXPLORE flights | flights_aircraft_sessionized"
    );
    await bqCompile(sql);
  });

  it("flights.flights_by_manufacturer", async () => {
    const sql = await compileQuery(
      faa,
      "EXPLORE flights | flights_by_manufacturer"
    );
    await bqCompile(sql);
  });

  it("flights.flights_by_carrier_2001_2002", async () => {
    const sql = await compileQuery(
      faa,
      "EXPLORE flights | flights_by_carrier_2001_2002"
    );
    await bqCompile(sql);
  });

  it("timeframes aliased", async () => {
    const sql = await compileQuery(
      faa,
      `
      EXPLORE flights | reduce
        hour_of_day is dep_time.hour_of_day
    `
    );
    await bqCompile(sql);
  });

  it("count distinct", async () => {
    const sql = await compileQuery(
      faa,
      `
      EXPLORE flights | reduce
        carrier_count is count(distinct carrier)
    `
    );
    // console.log(result.sql);
    await bqCompile(sql);
  });

  it("table_base_on_query", async () => {
    const result = await faa
      ._loadQueryFromQueryDef({
        structRef: "medicare_state_facts",
        pipeline: [
          {
            type: "reduce",
            fields: ["provider_state", "num_providers"],
            orderBy: [{ dir: "desc", field: 2 }],
          },
        ],
      })
      .run();
    expect(result.data.value[0].num_providers).toBe(296);
  });

  // const faa2: TestDeclaration[] = [

  it("table_base_on_query2", async () => {
    const result = await faa
      ._loadQueryFromQueryDef({
        structRef: {
          type: "struct",
          name: "malloy-data.malloytest.bq_medicare_test",
          dialect: "standardsql",
          as: "mtest",
          structRelationship: { type: "basetable", connectionName: "test" },
          structSource: { type: "table" },
          fields: [
            {
              type: "number",
              name: "c",
              aggregate: true,
              e: [{ type: "aggregate", function: "count", e: [] }],
            },
            {
              type: "turtle",
              name: "get_count",
              pipeline: [{ type: "reduce", fields: ["c"] }],
            },
          ],
        },
        pipeHead: { name: "get_count" },
        pipeline: [],
      })
      .run();
    expect(result.data.value[0].c).toBe(202656);
  });
});

const airportModelText = `
export define airports is (explore 'malloy-data.malloytest.airports'
  primary key code
  airport_count is count(*),

  by_fac_type is (reduce
    fac_type,
    airport_count,
  ),

  by_state is (reduce
    state,
    airport_count,
  ),

  by_county is (reduce
    county,
    airport_count,
  ),
);

define ca_airports is (airports | by_fac_type : [state: 'CA' | 'NY'])
`;

describe("airport_tests", () => {
  let model: malloy.ModelMaterializer;
  beforeAll(async () => {
    model = runtime.loadModel(airportModelText);
  });

  it("airport_count", async () => {
    const result = await runQuery(
      model,
      `
      explore airports | reduce
      a is count(*)
    `
    );
    expect(result.data.value[0].a).toBe(19793);
  });

  it("turtle_from_hell", async () => {
    const result = await runQuery(
      model,
      `
      explore airports | reduce
        zero is (reduce
          by_faa_region_i is (reduce : [county:~'I%', state != NULL]
            faa_region,
            airport_count,
            by_state is (reduce
              state,
              airport_count,
              by_county is (reduce
                county,
                airport_count
              )
            )
          ),
          by_faa_region_Z is (reduce : [county:~'Z%', state !=NULL]
            faa_region,
            airport_count,
            by_state is (reduce
              state,
              airport_count,
              by_county is (reduce
                county,
                airport_count
              )
            )
          ),
        )
      | project zero.by_faa_region_Z.by_state.by_county.county limit 1

    `
    );
    expect(result.data.value[0].county).toBe("ZAVALA");
  });

  it("nested_project", async () => {
    const result = await runQuery(
      model,
      `
    explore airports | reduce
      county,
      stuff is (project elevation order by 1 desc limit 10)
      order by 1
    | project stuff.elevation limit 1
    `
    );
    expect(result.data.value[0].elevation).toBe(1836);
  });

  it("nested_sums", async () => {
    const result = await runQuery(
      model,
      `
        explore airports | reduce
        airport_count,
        by_state is (reduce
          state,
          airport_count,
          by_fac_type is (reduce
            fac_type,
            airport_count
          )
        )
      | reduce
        airport_count,
        sum_state is by_state.sum(by_state.airport_count),
        sum_fac is by_state.by_fac_type.sum(by_state.by_fac_type.airport_count)
    `
    );
    // console.log(result.sql);
    expect(result.data.value[0].sum_state).toBe(19793);
    expect(result.data.value[0].sum_fac).toBe(19793);
  });

  it("pipeline_as_declared_turtle", async () => {
    const result = await runQuery(
      model,
      `
        define my_airports is (airports
          pipe_turtle is (reduce
            a is airport_count,
          | reduce
            a
          )
        )
        explore my_airports | pipe_turtle
    `
    );
    expect(result.data.value[0].a).toBe(19793);
  });

  it("pipeline Turtle", async () => {
    const result = await runQuery(
      model,
      `
        explore airports
        | reduce
          airport_count
          pipe_turtle is (reduce
            state
            county
            a is airport_count,
          | project
            state is upper(state)
            a
          | reduce
            state
            total_airports is a.sum()
          )
    `
    );

    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result.data.value[0] as any).pipe_turtle[0].total_airports
    ).toBe(1845);
  });

  it.skip("crossjoined turtles", async () => {
    // const result = await runQuery(model,`
    //     explore airports
    //     | reduce
    //       top_seaplane is (reduce limit 5 : [fac_type: 'SEAPLANE BASE']
    //         state
    //         airport_count
    //       )
    //       by_state is (reduce
    //         state
    //         airport_count
    //       )
    //     | project : [top_seaplane.state = by_state.state]
    //       by_state.*
    // `);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // expect((result.data.value[0] as any).pipe_turtle[0].total_airports).toBe(1845);
  });

  it.skip("crossjoined turtles as turtle", async () => {
    // const result = await runQuery(model,`
    //     explore airports
    //     | reduce
    //       airport_count
    //       tp is (reduce
    //         top_seaplane is (reduce limit 5 : [fac_type: 'SEAPLANE BASE']
    //           state
    //           airport_count
    //         )
    //         by_state is (reduce
    //           state
    //           airport_count
    //         )
    //       | project : [top_seaplane.state = by_state.state]
    //         by_state.*
    //       )
    // `);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // expect((result.data.value[0] as any).pipe_turtle[0].total_airports).toBe(1845);
  });

  it("string_expressions", async () => {
    const result = await runQuery(
      model,
      `
      explore airports | reduce
        lower_state is lower(state),
        order by 1 DESC
        limit 10
    `
    );
    expect(result.data.value[0].lower_state).toBe("wy");
  });

  it("half_count", async () => {
    const result = await runQuery(
      model,
      `
      explore airports | reduce
        half is airport_count/2.0
    `
    );
    expect(result.data.value[0].half).toBe(9896.5);
  });
});

describe("sql injection tests", () => {
  const model = runtime._loadModelFromModelDef(testModel);
  jest.setTimeout(100000);

  test("string literal escapes quotes", async () => {
    const result = await runQuery(
      model,
      `
      flights | reduce test is 'foo\\''
    `
    );
    expect(result.data.value[0].test).toBe("foo'");
  });

  test("string filter escapes quotes", async () => {
    const result = await runQuery(
      model,
      `
      flights | reduce test is count() : [carrier: 'foo\\'']
    `
    );
    expect(result.data.value[0].test).toBe(0);
  });

  test("string literal escapes backslashes", async () => {
    const result = await runQuery(
      model,
      `
      flights | reduce test is 'foo\\\\\\''
    `
    );
    expect(result.data.value[0].test).toBe("foo\\'");
  });

  test("string filter escapes backslashes", async () => {
    const result = await runQuery(
      model,
      `
      flights | reduce test is count() : [carrier: 'foo\\\\\\'']
    `
    );
    expect(result.data.value[0].test).toBe(0);
  });

  test("comment in string", async () => {
    const result = await runQuery(
      model,
      `
      flights | reduce test is 'foo \\\\'--'
    `
    );
    expect(result.data.value[0].test).toBe("foo \\");
  });

  test("comment in string filter", async () => {
    let error;
    try {
      await runQuery(
        model,
        `
        flights | reduce test is count() : [carrier: 'foo \\\\' THEN 0 else 1 END) as test--']
      `
      );
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeUndefined();
  });

  test.todo("'malloytest\\'.tables' produces the wrong error...");

  test("nested_table", async () => {
    const result = await runQuery(
      model,
      `
      flights | reduce test is 'foo \\\\'--'
    `
    );
    expect(result.data.value[0].test).toBe("foo \\");
  });
});
