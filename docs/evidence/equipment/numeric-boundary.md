# Mixed integer and exact decimal arithmetic

WP22's visible query authoring found a generic defect: `sum(unit_price * quantity)` rejected an integer quantity and exact decimal price with TYPE_MISMATCH. The expression UI offers no cast. The coordinating agent authorized the narrow shared correction before editing production source.

`arithmeticResultType` in model validation is the single browser-safe result rule. Integer/decimal arithmetic in either order adopts the decimal operand's complete precision, scale, encoding and rounding. The validator, query-designer inference and SQL compiler consume that rule. Comparisons, key/FK compatibility, real/decimal mixing and differently configured decimal operands retain their existing strict checks.

Compilation selects exact `sb_*` functions from either decimal operand. Their existing safe-integer SQLite function registration receives integer values as BigInt; no Number conversion or binary money arithmetic was introduced. The same compiled SQL and emitted decimal implementation serve preview and generated reports.

`packages/sqlite/tests/query/mixed-numeric.test.ts` covers both multiplication orders, shared UI inference, unchanged comparison rejection, integer/real rejection, differing decimal format rejection, NULL propagation, integers beyond Number's safe boundary and at SQLite's signed maximum, half-even division rounding, and precision overflow. Both generic tests pass. A broader focused run passed 135 tests across 14 model/query/decimal/designer/report files. Studio production build and workspace typecheck also passed. Full Equipment runtime agreement is recorded separately when actually executed.

No acceptance table, field or route constants were added to the engine. The integer quantity remains integer in the visibly authored application.
