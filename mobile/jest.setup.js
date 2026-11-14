jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn().mockResolvedValue(undefined),
  allowScreenCaptureAsync: jest.fn().mockResolvedValue(undefined),
  usePreventScreenCapture: jest.fn(),
  addScreenshotListener: jest.fn(() => ({ remove: jest.fn() })),
  removeScreenshotListener: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));
