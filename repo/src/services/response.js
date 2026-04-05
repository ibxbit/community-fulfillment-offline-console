export function ok(data, status = 200) {
  return { status, data, error: null };
}

export function fail(message, status = 400, details = null) {
  return {
    status,
    data: null,
    error: {
      message,
      details,
    },
  };
}
