import { ValidationContext, ASTVisitor, GraphQLError } from 'graphql';

export function depthLimitRule(maxDepth: number) {
  return (context: ValidationContext): ASTVisitor => {
    let currentDepth = 0;
    return {
      SelectionSet: {
        enter(node) {
          currentDepth++;
          if (currentDepth > maxDepth) {
            context.reportError(
              new GraphQLError(`Maximum query depth of ${maxDepth} exceeded.`, {
                nodes: [node]
              })
            );
          }
        },
        leave() {
          currentDepth--;
        }
      }
    };
  };
}

export function complexityLimitRule(maxComplexity: number) {
  return (context: ValidationContext): ASTVisitor => {
    let totalComplexity = 0;

    return {
      Field: {
        enter(node) {
          // Nested fields / lists have a cost of 5, leaf nodes have a cost of 1.
          const cost = node.selectionSet ? 5 : 1;
          totalComplexity += cost;
        }
      },
      Document: {
        leave(node) {
          if (totalComplexity > maxComplexity) {
            context.reportError(
              new GraphQLError(`Maximum query complexity of ${maxComplexity} exceeded (actual: ${totalComplexity}).`, {
                nodes: [node]
              })
            );
          }
        }
      }
    };
  };
}
