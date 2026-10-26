// Labels and sections are supplied by the catalog, independently of tool names.
export function pluginRole(tool) { return tool.role || ''; }
export function pluginSection(tool, categoryId) { return tool.sectionsByCategory?.[categoryId] || ''; }
