/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  FunctionParameterDef,
  Fragment,
  FieldValueType,
  TypeDesc,
  Expr,
  FunctionParamTypeDesc,
} from '../..';

export interface DialectFunctionOverloadDef {
  // The expression type here is the MINIMUM return type
  returnType: TypeDesc;
  params: FunctionParameterDef[];
  e: Expr;
}

export function arg(name: string): Fragment {
  return {
    type: 'function_parameter',
    name,
  };
}

export function spread(f: Fragment): Fragment {
  return {
    type: 'spread',
    e: [f],
  };
}

export function sql(...e: Expr): Fragment {
  return {
    type: 'sql_expression',
    e,
  };
}

export function constant(type: TypeDesc): TypeDesc {
  return {
    ...type,
    evalSpace: 'constant',
  };
}

export function output(type: TypeDesc): TypeDesc {
  return {
    ...type,
    evalSpace: 'output',
  };
}

export function params(
  name: string,
  ...allowedTypes: FunctionParamTypeDesc[]
): FunctionParameterDef {
  return {
    name,
    isVariadic: true,
    allowedTypes,
  };
}

export function param(
  name: string,
  ...allowedTypes: FunctionParamTypeDesc[]
): FunctionParameterDef {
  return {
    name,
    isVariadic: false,
    allowedTypes,
  };
}

export function maxScalar(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'scalar',
    evalSpace: 'input',
  };
}

export function maxAggregate(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'aggregate',
    evalSpace: 'input',
  };
}

export function anyExprType(dataType: FieldValueType): FunctionParamTypeDesc {
  return {
    dataType,
    expressionType: undefined,
    evalSpace: 'input',
  };
}

export function maxUngroupedAggregate(
  dataType: FieldValueType
): FunctionParamTypeDesc {
  return {
    dataType,
    expressionType: 'ungrouped_aggregate',
    evalSpace: 'input',
  };
}

export function maxAnalytic(dataType: FieldValueType): FunctionParamTypeDesc {
  return {
    dataType,
    expressionType: 'aggregate_analytic',
    evalSpace: 'input',
  };
}

export function minScalar(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'scalar',
    evalSpace: 'input',
  };
}

export function minAggregate(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'aggregate',
    evalSpace: 'input',
  };
}

export function minAnalytic(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'scalar_analytic',
    evalSpace: 'input',
  };
}

export function overload(
  returnType: TypeDesc,
  params: FunctionParameterDef[],
  e: Expr
): DialectFunctionOverloadDef {
  return {
    returnType,
    params,
    e,
  };
}
