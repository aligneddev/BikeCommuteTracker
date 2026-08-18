export const authUser = {
  id: "1",
  username: "johndoe",
  email: "john@example.com",
  fullName: "John Doe",
  phone: "+1 (555) 000-0000",
  organization: "Acme Corp",
};

export const authSession = {
  user: authUser,
  token: "mock-valid-token",
};

export const emptyEvents = [];

export const morningCommutePreset = {
  presetId: 101,
  name: "Morning Commute",
  primaryDirection: "North",
  periodTag: "morning",
  exactStartTimeLocal: "07:30",
  durationMinutes: 55,
  miles: 12,
  lastUsedAtUtc: "2026-08-17T12:00:00Z",
  updatedAtUtc: "2026-08-17T12:00:00Z",
};

export const presetWeatherResponse = {
  rideDateTimeLocal: "2026-08-18T07:30",
  temperature: 68,
  windSpeedMph: 8,
  windDirectionDeg: 180,
  relativeHumidityPercent: 52,
  cloudCoverPercent: 25,
  precipitationType: "None",
  isAvailable: true,
};

export const loadWeatherResponse = {
  rideDateTimeLocal: "2024-06-10T14:25",
  temperature: 66,
  windSpeedMph: 11,
  windDirectionDeg: 315,
  relativeHumidityPercent: 58,
  cloudCoverPercent: 35,
  precipitationType: "Rain",
  isAvailable: true,
};
