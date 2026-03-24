let pluginApi = null;

export function setPluginApi(api) {
  pluginApi = api;
}

export function getPluginApi() {
  if (!pluginApi) throw new Error("[textclaw] pluginApi not initialized");
  return pluginApi;
}
