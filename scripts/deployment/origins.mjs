// All errors are fixed codes: invalid values may contain credentials.
export function deploymentOrigins(env = process.env) {
  const production = env.HYPOTHRON_DEPLOYMENT === "1";
  const result = {
    app:
      env.APP_ORIGIN ||
      env.HYPOTHRON_APP_ORIGIN ||
      (production ? "" : "http://127.0.0.1:3000"),
    api:
      env.API_ORIGIN ||
      env.NEXT_PUBLIC_API_ORIGIN ||
      (production ? "" : "http://127.0.0.1:8000"),
    executor:
      env.EXECUTOR_ORIGIN ||
      env.HYPOTHRON_EXECUTOR_ORIGIN ||
      env.NEXT_PUBLIC_EXECUTOR_ORIGIN ||
      (production ? "" : "http://127.0.0.1:3001"),
  };
  try {
    const urls = Object.values(result).map((value) => {
      const url = new URL(value);
      if (
        !/^[a-zA-Z0-9.:-]+$/.test(url.hostname) ||
        url.origin !== value ||
        url.username ||
        url.password ||
        !["http:", "https:"].includes(url.protocol) ||
        (production && url.protocol !== "https:")
      )
        throw Error();
      return url;
    });
    if (
      new Set(urls.map((url) => url.origin)).size !== 3 ||
      (production && new Set(urls.map((url) => url.hostname)).size !== 3)
    )
      throw Error();
  } catch {
    throw new Error("INVALID_DEPLOYMENT_ORIGINS");
  }
  return result;
}
