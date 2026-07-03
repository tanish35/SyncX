export async function register() {
  if (process.env.NODE_ENV === "development") {
    const { initOpenNextCloudflareForDev } = await import(
      "@opennextjs/cloudflare"
    );
    await initOpenNextCloudflareForDev();
  }
}
