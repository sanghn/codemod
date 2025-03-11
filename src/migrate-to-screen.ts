import type {
  API,
  AwaitExpression,
  CallExpression,
  FileInfo,
  Identifier,
  ObjectPattern,
  ObjectProperty,
} from 'jscodeshift';

const transformer = (fileInfo: FileInfo, api: API) => {
  const j = api.jscodeshift;

  if (!/\.(spec|test)\.(js|ts)x?$/.test(fileInfo.path)) {
    return fileInfo.source;
  }

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

  const migrationAvailable = methodsToMigrate.some(
    (methodName) =>
      root
        .find(j.CallExpression, {
          callee: {
            type: 'Identifier',
            name: methodName,
          },
        })
        .size() > 0
  );

  if (!migrationAvailable) return fileInfo.source;

  methodsToMigrate.forEach((methodName) => {
    root
      .find(j.CallExpression, {
        callee: {
          type: 'Identifier',
          name: methodName,
        },
      })
      .replaceWith((path) => {
        const calleeIdentifier = path.node.callee as Identifier;

        const screenIdentifier = j.identifier('screen');
        const memberExpression = j.memberExpression(
          screenIdentifier,
          j.identifier(calleeIdentifier.name)
        );

        return j.callExpression(memberExpression, path.node.arguments);
      });
  });

  // Remove destructured queries from render calls
  root
    .find(j.VariableDeclarator)
    .filter((path) => {
      if (path.node.id.type !== 'ObjectPattern') return false;

      const isCallExpression =
        path.node.init?.type === 'CallExpression' &&
        path.node.init.callee.type === 'Identifier' &&
        path.node.init.callee.name !== 'within';

      const isAwaitExpression =
        path.node.init?.type === 'AwaitExpression' &&
        path.node.init.argument?.type === 'CallExpression' &&
        path.node.init.argument.callee.type === 'Identifier' &&
        path.node.init.argument.callee.name !== 'within';

      if (!isCallExpression && !isAwaitExpression) return false;

      return (path.node.id as ObjectPattern).properties.some((property) => {
        const prop = property as ObjectProperty;
        return (
          prop.key.type === 'Identifier' &&
          methodsToMigrate.includes(prop.key.name)
        );
      });
    })
    .forEach((path) => {
      const objectPattern = path.node.id as ObjectPattern;
      const leftOverProperties = objectPattern.properties.filter((property) => {
        return (
          property.type === 'ObjectProperty' &&
          property.key.type === 'Identifier' &&
          !methodsToMigrate.includes(property.key.name)
        );
      });

      if (leftOverProperties.length === objectPattern.properties.length) return;

      // All properties are removed
      if (leftOverProperties.length === 0) {
        // Remove the entire destructured object
        const variableDeclarationPath = path.parentPath.parentPath;

        const expressionStatement = j.expressionStatement(
          path.node.init as CallExpression | AwaitExpression
        );

        // Get leading comments
        const leadingComments = variableDeclarationPath.node.leadingComments;

        // Attach leading comments to the new ExpressionStatement
        if (leadingComments) {
          expressionStatement.comments = leadingComments;
        }

        j(path.parentPath.parentPath).replaceWith(expressionStatement);
      } else {
        // Remove the migrated properties
        objectPattern.properties = leftOverProperties;
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

export const parser = 'tsx';

export default transformer;
