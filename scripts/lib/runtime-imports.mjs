import ts from 'typescript';

export function runtimeImports(code, filename) {
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const imports = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return imports;
}
