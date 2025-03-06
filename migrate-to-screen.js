module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const methodRegexes = [
    /^getBy/,
    /^getAllBy/,
    /^queryBy/,
    /^queryAllBy/,
    /^findBy/,
    /^findAllBy/,
  ];

  methodRegexes.forEach((regex) => {
    root
      .find(j.CallExpression)
      .filter(
        (path) =>
          path.node.callee.type === 'Identifier' &&
          path.node.callee.name.match(regex)
      )
      .replaceWith((path) => {
        const screenIndentifier = j.identifier('screen');
        const memberExpression = j.memberExpression(
          screenIndentifier,
          j.identifier(path.node.callee.name)
        );

        return j.callExpression(memberExpression, path.node.arguments);
      });
  });

  // Remove destructured queries from render calls
  root
    .find(j.VariableDeclarator, {
      id: {
        type: 'ObjectPattern',
      },
    })
    .filter((path) => {
      return (
        path.node.init &&
        path.node.init.type === 'CallExpression' &&
        path.node.init.callee.name.startsWith('renderWith')
      );
    })
    .forEach((path) => {
      const propertiesToRemove = path.node.id.properties.filter((property) =>
        methodRegexes.some((regex) => property.key.name.match(regex))
      );

      if (propertiesToRemove.length > 0) {
        const newProperties = path.node.id.properties.filter(
          (property) => !propertiesToRemove.includes(property)
        );

        path.node.id.properties = newProperties;

        if (newProperties.length === 0) {
          // Remove the entire destructured object if all properties are removed
          const expressionStatement = j.expressionStatement(path.node.init);
          j(path.parentPath.parentPath).replaceWith(expressionStatement);
        }
      }
    });

  // Ensure 'screen' is imported from '@testing-library/react'
  const testingLibraryImport = root.find(j.ImportDeclaration, {
    source: {
      value: '@testing-library/react',
    },
  });

  if (testingLibraryImport.size() > 0) {
    // Import exists, check if 'screen' is imported
    const screenImport = testingLibraryImport.find(j.ImportSpecifier, {
      imported: {
        name: 'screen',
      },
    });

    if (screenImport.size() === 0) {
      // 'screen' is not imported, add it
      testingLibraryImport
        .get()
        .node.specifiers.push(j.importSpecifier(j.identifier('screen')));
    }
  } else {
    // No existing import, create a new one
    const newImport = j.importDeclaration(
      [j.importSpecifier(j.identifier('screen'))],
      j.literal('@testing-library/react')
    );

    // find the first import statement, insert new import declaration before it
    const firstImport = root.find(j.ImportDeclaration).at(0);
    if (firstImport.size() > 0) {
      firstImport.insertBefore(newImport);
    } else {
      // No existing import statements, insert at the top of the file
      root.get().node.body.unshift(newImport);
    }
  }

  return root.toSource();
};
