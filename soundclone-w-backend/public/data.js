// Mock data for the SoundCloud clone
const mockData = {
  tracks: [
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Acoustic Guitar Sample",
      description: "A sample guitar track for testing playback",
      fileType: "wav",
      originalFilename: "test-guitar.wav",
      createdAt: "2025-05-20T01:30:00.000Z",
      updatedAt: "2025-05-20T01:35:00.000Z",
      duration: 180, // Will be determined by actual audio
      shareableLink: "550e8400-e29b-41d4-a716-446655440000",
      audioUrl: "assets/test-guitar.wav",
      comments: [
        {
          id: "c550e840-e29b-41d4-a716-446655440001",
          text: "Love the melody at @01:30!",
          timestamp: "2025-05-20T01:40:00.000Z",
          updatedAt: "2025-05-20T01:40:00.000Z",
          trackTimestamp: 90,
          hasTimestamp: true
        },
        {
          id: "c550e840-e29b-41d4-a716-446655440002",
          text: "The intro is so peaceful",
          timestamp: "2025-05-20T01:45:00.000Z",
          updatedAt: "2025-05-20T01:45:00.000Z",
          trackTimestamp: null,
          hasTimestamp: false
        },
        {
          id: "c550e840-e29b-41d4-a716-446655440003",
          text: "Nice transition at @00:45!",
          timestamp: "2025-05-20T01:50:00.000Z",
          updatedAt: "2025-05-20T01:50:00.000Z",
          trackTimestamp: 45,
          hasTimestamp: true
        }
      ]
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      title: "Guitar Improvisation (Copy)",
      description: "Another version of the guitar sample",
      fileType: "wav",
      originalFilename: "test-guitar.wav",
      createdAt: "2025-05-19T14:20:00.000Z",
      updatedAt: "2025-05-19T14:25:00.000Z",
      duration: 180, // Will be determined by actual audio
      shareableLink: "550e8400-e29b-41d4-a716-446655440001",
      audioUrl: "assets/test-guitar.wav",
      comments: [
        {
          id: "c550e840-e29b-41d4-a716-446655440004",
          text: "Great fingerpicking at @02:15!",
          timestamp: "2025-05-19T15:30:00.000Z",
          updatedAt: "2025-05-19T15:30:00.000Z",
          trackTimestamp: 135,
          hasTimestamp: true
        }
      ]
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440002",
      title: "Voice Memo - Project Ideas",
      description: "Brainstorming session for new project",
      fileType: "wav",
      originalFilename: "test-guitar.wav",
      createdAt: "2025-05-18T09:10:00.000Z",
      updatedAt: "2025-05-18T09:15:00.000Z",
      duration: 180, // Will be determined by actual audio
      shareableLink: "550e8400-e29b-41d4-a716-446655440002",
      audioUrl: "assets/test-guitar.wav",
      comments: [
        {
          id: "c550e840-e29b-41d4-a716-446655440005",
          text: "Important point at @00:35 about the timeline",
          timestamp: "2025-05-18T10:20:00.000Z",
          updatedAt: "2025-05-18T10:20:00.000Z",
          trackTimestamp: 35,
          hasTimestamp: true
        },
        {
          id: "c550e840-e29b-41d4-a716-446655440006",
          text: "Need to follow up on the resources mentioned at @01:45",
          timestamp: "2025-05-18T11:05:00.000Z",
          updatedAt: "2025-05-18T11:05:00.000Z",
          trackTimestamp: 105,
          hasTimestamp: true
        }
      ]
    }
  ]
};
