export async function GET() {
  const manifest = {
    id: "community.syncx",
    version: "0.1.0",
    name: "SyncX",
    description: "Sync watch progress between Stremio and Nuvio",
    resources: ["catalog"],
    types: ["movie", "series"],
    catalogs: [
      {
        type: "series",
        id: "syncx_status",
        name: "SyncX Status",
      },
    ],
    behaviorHints: {
      configurable: true,
      configurationRequired: false,
    },
  };

  return Response.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
