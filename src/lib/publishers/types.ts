export type PublishResult = {
  url?: string;
  id?: string;
};

export class PublisherConfigError extends Error {}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new PublisherConfigError(
      `${name} is not set. Add your own credential to .env to enable this destination.`,
    );
  }
  return value;
}
