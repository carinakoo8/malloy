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
lexer grammar MalloyLexer;

JSON_STRING: '"' (ESC | SAFECODEPOINT)* '"';

fragment ESC: '\\' (["\\/bfnrt] | UNICODE);
fragment UNICODE: 'u' HEX HEX HEX HEX;
fragment HEX: [0-9a-fA-F];
fragment SAFECODEPOINT: ~ ["\\\u0000-\u001F];
fragment SPACE_CHAR: [ \u000B\t\r\n];

// colon keywords ...
ACCEPT: A C C E P T SPACE_CHAR* ':';
AGGREGATE: A G G R E G A T E SPACE_CHAR* ':';
DECLARE: D E C L A R E  ':' ;
DIMENSION: D I M E N S I O N SPACE_CHAR* ':';
EXCEPT: E X C E P T SPACE_CHAR* ':';
EXPLORE: E X P L O R E SPACE_CHAR* ':';
GROUP_BY: G R O U P '_' B Y SPACE_CHAR* ':';
HAVING: H A V I N G SPACE_CHAR* ':';
INDEX: I N D E X SPACE_CHAR* ':';
JOIN_CROSS: J O I N '_' C R O S S ':';
JOIN_ONE: J O I N '_' O N E SPACE_CHAR* ':';
JOIN_MANY: J O I N '_' M A N Y SPACE_CHAR* ':';
LIMIT: L I M I T SPACE_CHAR* ':';
MEASURE: M E A S U R E SPACE_CHAR* ':';
NEST: N E S T SPACE_CHAR* ':';
ORDER_BY: O R D E R '_' B Y SPACE_CHAR* ':';
PRIMARY_KEY: P R I M A R Y '_' K E Y SPACE_CHAR* ':';
PROJECT: P R O J E C T SPACE_CHAR* ':';
QUERY: Q U E R Y SPACE_CHAR* ':';
RENAME: R E N A M E SPACE_CHAR* ':';
SAMPLE: S A M P L E SPACE_CHAR* ':';
SOURCE: S O U R C E SPACE_CHAR* ':';
SQL: S Q L SPACE_CHAR* ':';
FANCYSQL: T U R D U C K SPACE_CHAR* ':';
TOP: T O P SPACE_CHAR* ':';
WHERE: W H E R E SPACE_CHAR* ':';

// bare keywords
ALL: A L L;
AND: A N D ;
AS: A S ;
ASC: A S C ;
AVG: A V G ;
BOOLEAN: B O O L E A N;
BY: B Y ;
CASE: C A S E ;
CAST: C A S T ;
CONDITION: C O N D I T I O N ;
COUNT: C O U N T ;
DATE: D A T E;
DAY: D A Y S?;
DESC: D E S C ;
DISTINCT: D I S T I N C T ;
ELSE: E L S E ;
END: E N D ;
EXCLUDE: E X C L U D E;
FALSE: F A L S E;
FOR: F O R;
FROM: F R O M ;
FROM_SQL: F R O M '_' S Q L;
HAS: H A S ;
HOUR: H O U R S?;
IMPORT: I M P O R T;
IS: I S ;
JSON: J S O N;
LAST: L A S T ;
MAX: M A X;
MIN: M I N;
MINUTE: M I N U T E S?;
MONTH: M O N T H S?;
NOT: N O T ;
NOW: N O W;
NULL: N U L L ;
NUMBER: N U M B E R;
ON: O N ;
OR: O R ;
PICK: P I C K ;
QMARK: '?';
QUARTER: Q U A R T E R S?;
SECOND: S E C O N D S?;
STRING: S T R I N G;
SUM: S U M ;
TABLE: T A B L E;
THEN: T H E N ;
THIS: T H I S;
TIMESTAMP: T I M E S T A M P;
TO: T O;
TRUE: T R U E ;
TURTLE: T U R T L E;
WEEK: W E E K S?;
WHEN: W H E N ;
WITH: W I T H ;
YEAR: Y E A R S?;
UNGROUPED: U N G R O U P E D;

STRING_ESCAPE
  : '\\' '\''
  | '\\' '\\'
  | '\\' .
  ;

HACKY_REGEX: ('/' | [rR]) '\'' (STRING_ESCAPE | ~('\\' | '\''))* '\'';
STRING_LITERAL: '\'' (STRING_ESCAPE | ~('\\' | '\''))* '\'';

AMPER: '&';
ARROW: '->';
FAT_ARROW: '=>';
OPAREN: '(' ;
CPAREN: ')' ;
OBRACK: '[' ;
CBRACK: ']' ;
OCURLY: '{' ;
CCURLY: '}' ;
DOUBLECOLON: '::';
COLON: ':' ;
COMMA: ',';
DOT: '.' ;
LT: '<' ;
GT: '>' ;
EQ: '=' ;
NE: '!=' ;
LTE: '<=' ;
GTE: '>=' ;
PLUS: '+' ;
MINUS: '-' ;
STAR: '*' ;
STARSTAR: '**';
SLASH: '/' ;
BAR: '|' ;
SEMI: ';' ;
NOT_MATCH: '!~' ;
MATCH: '~' ;

fragment F_YEAR: DIGIT DIGIT DIGIT DIGIT;
fragment F_DD: DIGIT DIGIT;
fragment LX: '-' 'X' (ID_CHAR | DIGIT)+;
LITERAL_TIMESTAMP
  : '@' F_YEAR '-' F_DD '-' F_DD
    ' ' F_DD ':' F_DD ( ':' F_DD )? LX?
  ;
LITERAL_DAY:     '@' F_YEAR '-' F_DD '-' F_DD LX?;
LITERAL_QUARTER: '@' F_YEAR '-' 'Q' ('1'|'2'|'3'|'4') LX?;
LITERAL_MONTH:   '@' F_YEAR '-' F_DD LX?;
LITERAL_WEEK:    '@' W K F_YEAR '-' F_DD '-' F_DD LX?;
LITERAL_YEAR:    '@' F_YEAR LX?;

IDENTIFIER: ID_CHAR ( ID_CHAR | DIGIT )*;

PERCENT_LITERAL: DIGIT+ '%' ;
INTEGER_LITERAL: DIGIT+ ;

NUMERIC_LITERAL
  : DIGIT+ ( DOT DIGIT* ) ?
  | DOT DIGIT+ (E [-+]? DIGIT+)?
  ;

OBJECT_NAME_LITERAL: '`' ~[`]+ '`';

fragment ID_CHAR: [\p{Alphabetic}_] ;
fragment DIGIT: [0-9];
fragment A: [aA] ; fragment B: [bB] ; fragment C: [cC] ; fragment D: [dD] ;
fragment E: [eE] ; fragment F: [fF] ; fragment G: [gG] ; fragment H: [hH] ;
fragment I: [iI] ; fragment J: [jJ] ; fragment K: [kK] ; fragment L: [lL] ;
fragment M: [mM] ; fragment N: [nN] ; fragment O: [oO] ; fragment P: [pP] ;
fragment Q: [qQ] ; fragment R: [rR] ; fragment S: [sS] ; fragment T: [tT] ;
fragment U: [uU] ; fragment V: [vV] ; fragment W: [wW] ; fragment X: [xX] ;
fragment Y: [yY] ; fragment Z: [zZ] ;

BLOCK_COMMENT: '/*' .*? '*/' -> channel(HIDDEN);
COMMENT_TO_EOL: ('--' | '//') ~[\r\n]* (('\r'? '\n') | EOF) -> channel(HIDDEN) ;
WHITE_SPACE: SPACE_CHAR -> skip ;
SQL_STRING: '||' .*? ';;';

// Matching any of these is a parse error
UNWATED_CHARS_TRAILING_NUMBERS: DIGIT+ ID_CHAR+ (ID_CHAR | DIGIT)*;
UNEXPECTED_CHAR: .;
