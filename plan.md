first pass
- recognise symbol declarations
- validate use of expressions
- generate scope and children for symbols
  - scope contains code that can run with symbols and identifiers for variables, procedures and macros
  - children are expression-specific internals (for example fields/methods in a class, properties of a struct, etc)
- give each variable, list and procedure an ID

second pass (works inside each scope outside-in):
- generate blocks for each expression
- validate use of variable reference before declaration
- give each block an ID
- open up macros