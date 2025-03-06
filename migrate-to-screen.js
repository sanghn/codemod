module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const methodsToMigrate = [
    'findAllByAltText',
    'findAllByDisplayValue',
    'findAllByLabelText',
    'findAllByPlaceholderText',
    'findAllByRole',
    'findAllByTestId',
    'findAllByText',
    'findAllByTitle',
    'findByAltText',
    'findByDisplayValue',
    'findByLabelText',
    'findByPlaceholderText',
    'findByRole',
    'findByTestId',
    'findByText',
    'findByTitle',
    'getAllByAltText',
    'getAllByDisplayValue',
    'getAllByLabelText',
    'getAllByPlaceholderText',
    'getAllByRole',
    'getAllByTestId',
    'getAllByText',
    'getAllByTitle',
    'getByAltText',
    'getByDisplayValue',
    'getByLabelText',
    'getByPlaceholderText',
    'getByRole',
    'getByTestId',
    'getByText',
    'getByTitle',
    'queryAllByAltText',
    'queryAllByDisplayValue',
    'queryAllByLabelText',
    'queryAllByPlaceholderText',
    'queryAllByRole',
    'queryAllByTestId',
    'queryAllByText',
    'queryAllByTitle',
    'queryByAltText',
    'queryByDisplayValue',
    'queryByLabelText',
    'queryByPlaceholderText',
    'queryByRole',
    'queryByTestId',
    'queryByText',
    'queryByTitle',
  ];

  let needScreenImport = false;

  methodsToMigrate.forEach((methodName) => {
    root
      .find(j.CallExpression, {
        callee: {
          type: 'Identifier',
          name: methodName,
        },
      })
      .replaceWith((path) => {
        needScreenImport = true;

        const screenIdentifier = j.identifier('screen');
        const memberExpression = j.memberExpression(
          screenIdentifier,
          j.identifier(path.node.callee.name)
        );

        return j.callExpression(memberExpression, path.node.arguments);
      });
  });

  // Remove destructured queries from render calls
  root
    .find(j.VariableDeclarator, {
      id: { type: 'ObjectPattern' },
      init: {
        type: 'CallExpression',
        callee: { name: (name) => name !== 'within' },
      },
    })
    .filter((path) => {
      return path.node.id.properties.some((property) =>
        methodsToMigrate.includes(property.key.name)
      );
    })
    .forEach((path) => {
      const propertiesToRemove = path.node.id.properties.filter((property) =>
        methodsToMigrate.includes(property.key.name)
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

  if (needScreenImport) {
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
  }

  return root.toSource();
};
