export const IST_TIME_ZONE = "Asia/Kolkata";

export function formatIstDateTime(date: Date) {
  return `${date.toLocaleString("en-IN", {
    timeZone: IST_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  })} IST`;
}

export function formatIstDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    timeZone: IST_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatIstDay(date: Date) {
  return date.toLocaleDateString("en-IN", {
    timeZone: IST_TIME_ZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatIstTime(date: Date) {
  return `${date.toLocaleTimeString("en-IN", {
    timeZone: IST_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  })} IST`;
}
