export function validatePort({ value, isPublic }: { value: string; isPublic: boolean }) {
  if (!isPublic) return undefined;
  if (!value) return { message: "Port is required." };
  // check if the value contains only digits
  if (!/^\d+$/.test(value)) {
    return { message: "Port must be a positive integer." };
  }
  const portNumber = parseInt(value, 10);
  if (isNaN(portNumber)) {
    return { message: "Port must be a positive integer." };
  }
  if (portNumber < 1 || portNumber > 65535) {
    return { message: "Port must be between 1 and 65535." };
  }
  return undefined;
}
