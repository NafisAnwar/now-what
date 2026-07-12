import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const microActions = await server.ssrLoadModule('/src/engine/microActions.ts');
  const categories = await server.ssrLoadModule('/src/constants/categories.ts');

  process.stdout.write(JSON.stringify({
    microActions: microActions.MICRO_ACTIONS,
    needsCoverage: microActions.getMicroActionNeedsCoverage(),
    categories: {
      standard: categories.STANDARD_CATEGORY_OPTIONS,
      groups: categories.STANDARD_CATEGORY_OPTIONS.map(category => ({
        category,
        normalized: categories.normalizeCategory(category),
        group: categories.getTaskCategoryGroup(category),
        need: categories.getTaskCategoryNeed(category),
      })),
    },
  }, null, 2));
} finally {
  await server.close();
}
