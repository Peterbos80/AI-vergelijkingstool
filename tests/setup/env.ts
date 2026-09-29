// Tests never talk to real services.
const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = 'test';
env.APP_SECRET ??= 'test-secret-test-secret-test-secret-0123456789';
delete env.ANTHROPIC_API_KEY;
delete env.RESEND_API_KEY;
delete env.HEARTBEAT_URL;
