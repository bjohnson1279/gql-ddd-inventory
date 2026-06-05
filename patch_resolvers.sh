sed -i -e '/submitOpeningBalance: async (_: any, { input }: { input: any }, context: GraphQLContext) => {/,+15c\
    submitOpeningBalance: async (_: any, { input }: { input: any }, context: GraphQLContext) => {\
      try {\
        const auth = enforceRole(context, ['"'"'admin'"'"', '"'"'accountant'"'"'], input.tenantId, input.actorId);\
        await submitOpeningBalanceUseCase.execute({\
          tenantId: auth.tenantId,\
          locationId: input.locationId,\
          items: input.items,\
          asOfDate: input.asOfDate,\
          actorId: auth.actorId\
        });\
        return true;\
      } catch (error: any) {\
        throw new Error(error.message);\
      }\
    },' src/infrastructure/graphql/resolvers.ts
