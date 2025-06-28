import React, { useEffect, useState, useRef, useCallback } from "react";
import "./AudioPlayer.css";
import guitar from "./assets/guitar.png";

// Import dnd-kit components
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { arrayMove } from "@dnd-kit/sortable";

// Import dnd-kit modifiers
import {
  restrictToVerticalAxis, // Added
  restrictToWindowEdges, // Added
} from "@dnd-kit/modifiers";

const LOCAL_STORAGE_KEY = "audioPlayerState";

// Sound effects data
const SOUND_EFFECTS = [
  { id: "crow", name: "Crow", emoji: "🦅", description: "Crow cawing" },
  {
    id: "footsteps",
    name: "Footsteps",
    emoji: "👣",
    description: "Walking footsteps",
  },
  { id: "thunder", name: "Thunder", emoji: "⚡", description: "Thunder crash" },
  { id: "fire", name: "Fire", emoji: "🔥", description: "Crackling fire" },
  { id: "sword", name: "Sword", emoji: "⚔️", description: "Sword clash" },
  { id: "magic", name: "Magic", emoji: "✨", description: "Magic spell" },
  { id: "door", name: "Door", emoji: "🚪", description: "Door creak" },
  { id: "water", name: "Water", emoji: "💧", description: "Water splash" },
  { id: "wind", name: "Wind", emoji: "💨", description: "Howling wind" },
  { id: "bell", name: "Bell", emoji: "🔔", description: "Bell toll" },
];

// Function to generate a random dark color
const generateRandomDarkColor = () => {
  // Generate very dark colors (values 5-40 for RGB - much darker)
  const r = Math.floor(Math.random() * 35) + 5;
  const g = Math.floor(Math.random() * 35) + 5;
  const b = Math.floor(Math.random() * 35) + 5;
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

// Custom muted dark colors for audio entries (fallback)
const ENTRY_COLORS = [
  "#1a1a1a", // Very dark gray
  "#1f1f1f", // Slightly lighter dark gray
  "#242424", // Dark gray
  "#292929", // Medium dark gray
  "#2e2e2e", // Another dark gray variant
  "#333333", // Dark gray
  "#383838", // Slightly lighter
  "#3d3d3d", // Another variant
  "#424242", // Medium gray
  "#474747", // Another medium gray
  "#4c4c4c", // Slightly lighter gray
  "#515151", // Another variant
  "#565656", // Medium gray
  "#5b5b5b", // Another variant
  "#606060", // Slightly lighter
];

// SortableItem component for individual audio items
const SortableItem = ({
  video,
  nowPlaying,
  videoProgress,
  formatTime,
  updateTitle,
  updateVolume,
  togglePlay,
  removeVideo,
  handleSeekChange,
  handleSeekStart,
  handleSeekEnd,
  index, // Add index prop
  trackColors, // Add trackColors prop
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor:
      trackColors[video.id] || ENTRY_COLORS[index % ENTRY_COLORS.length], // Use stored color or fallback
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`audio-item ${nowPlaying.includes(video.id) ? "playing" : ""}`}
    >
      <div className="audio-info">
        <input
          type="text"
          value={video.title}
          onChange={(e) => updateTitle(video.id, e.target.value)}
          className="title-input"
        />
        <a
          href={`https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noreferrer"
          className="audio-link"
          title="Open in YouTube"
        >
          (Link)
        </a>
      </div>

      <div className="audio-controls">
        <div className="volume-slider-container">
          <span className="volume-value">{video.volume}%</span>
          <input
            type="range"
            min="0"
            max="100"
            value={video.volume}
            onChange={(e) => updateVolume(video.id, parseInt(e.target.value))}
            className="volume-slider"
          />
        </div>

        <div className="progress-slider-container">
          <span className="current-time">
            {formatTime(videoProgress[video.id]?.currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={videoProgress[video.id]?.duration || 0}
            value={videoProgress[video.id]?.currentTime || 0}
            className="progress-slider"
            onChange={(e) => handleSeekChange(video.id, e)}
            onMouseDown={handleSeekStart}
            onMouseUp={(e) => handleSeekEnd(video.id, e)}
            onTouchStart={handleSeekStart}
            onTouchEnd={(e) => handleSeekEnd(video.id, e)}
          />
          <span className="duration">
            {formatTime(videoProgress[video.id]?.duration)}
          </span>
        </div>

        <button
          onClick={() => togglePlay(video.id)}
          className="audio-btn play-btn"
          aria-label={
            nowPlaying.includes(video.id) ? "Pause audio" : "Play audio"
          }
        >
          {nowPlaying.includes(video.id) ? "⏸" : "▶"}
        </button>
        <button
          onClick={() => removeVideo(video.id)}
          className="audio-btn delete-btn"
          aria-label="Remove audio"
        >
          🗑
        </button>
        {/* Add a handle for dragging */}
        <button
          {...listeners}
          className="audio-btn drag-handle"
          aria-label="Drag to reorder"
        >
          ☰
        </button>
      </div>
    </div>
  );
};

const AudioPlayer = () => {
  const loadStateFromLocalStorage = useCallback(() => {
    try {
      const serializedState = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (serializedState === null) {
        return { videos: [], videoProgress: {}, trackColors: {} };
      }
      const loadedState = JSON.parse(serializedState);
      return {
        videos: Array.isArray(loadedState.videos) ? loadedState.videos : [],
        videoProgress:
          typeof loadedState.videoProgress === "object" &&
          loadedState.videoProgress !== null
            ? loadedState.videoProgress
            : {},
        trackColors:
          typeof loadedState.trackColors === "object" &&
          loadedState.trackColors !== null
            ? loadedState.trackColors
            : {},
      };
    } catch (error) {
      console.error("Error loading state from local storage:", error);
      return { videos: [], videoProgress: {}, trackColors: {} };
    }
  }, []);

  const initialLoad = loadStateFromLocalStorage();

  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [videos, setVideos] = useState(initialLoad.videos);
  const players = useRef({});
  const [nowPlaying, setNowPlaying] = useState([]);
  const [ytReady, setYtReady] = useState(false);
  const [videoProgress, setVideoProgress] = useState(initialLoad.videoProgress);
  const [trackColors, setTrackColors] = useState(initialLoad.trackColors);
  const [isSeeking, setIsSeeking] = useState(false);
  const progressIntervals = useRef({});
  const [playerElements, setPlayerElements] = useState(
    initialLoad.videos.map((v) => v.id)
  );
  const [customSounds, setCustomSounds] = useState({});
  const [soundEffectVolume, setSoundEffectVolume] = useState(50); // Volume for sound effects (0-100)
  const [currentlyPlayingSound, setCurrentlyPlayingSound] = useState(null); // Track currently playing sound
  const soundEffectAudio = useRef(null); // Reference to current sound effect audio

  // Load custom sounds from localStorage
  useEffect(() => {
    const savedCustomSounds = localStorage.getItem("customSoundEffects");
    const savedVolume = localStorage.getItem("soundEffectVolume");
    if (savedCustomSounds) {
      try {
        setCustomSounds(JSON.parse(savedCustomSounds));
      } catch (error) {
        console.error("Error loading custom sounds:", error);
      }
    }
    if (savedVolume) {
      setSoundEffectVolume(parseInt(savedVolume));
    }
  }, []);

  // Save custom sounds to localStorage
  const saveCustomSound = (effectId, audioBlob) => {
    const url = URL.createObjectURL(audioBlob);
    const newCustomSounds = { ...customSounds, [effectId]: url };
    setCustomSounds(newCustomSounds);
    localStorage.setItem("customSoundEffects", JSON.stringify(newCustomSounds));
  };

  // Save volume to localStorage
  useEffect(() => {
    localStorage.setItem("soundEffectVolume", soundEffectVolume.toString());
  }, [soundEffectVolume]);

  // Stop currently playing sound effect
  const stopSoundEffect = () => {
    if (soundEffectAudio.current) {
      soundEffectAudio.current.pause();
      soundEffectAudio.current.currentTime = 0;
      soundEffectAudio.current = null;
    }
    setCurrentlyPlayingSound(null);
  };

  // Update volume of currently playing sound effect
  const updateSoundEffectVolume = (newVolume) => {
    if (soundEffectAudio.current) {
      soundEffectAudio.current.volume = newVolume / 100;
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume) => {
    setSoundEffectVolume(newVolume);
    updateSoundEffectVolume(newVolume);
  };

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Optional: helps prevent accidental drags
      },
      scroll: false, // Prevents unwanted scrolling during drag
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      // Correct YouTube IFrame API URL
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setYtReady(true);
      };
    } else {
      setYtReady(true);
    }
  }, []);

  useEffect(() => {
    try {
      const stateToSave = {
        videos: videos,
        videoProgress: videoProgress,
        trackColors: trackColors,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Error saving state to local storage:", error);
    }
  }, [videos, videoProgress, trackColors]);

  const createPlayer = useCallback(
    (video) => {
      const playerElement = document.getElementById(`player-${video.id}`);
      if (
        playerElement &&
        !players.current[video.id] &&
        window.YT &&
        window.YT.Player
      ) {
        players.current[video.id] = new window.YT.Player(`player-${video.id}`, {
          height: "0",
          width: "0",
          videoId: video.id,
          playerVars: {
            autoplay: 0, // Ensure autoplay is off
            controls: 0,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              event.target.setVolume(video.volume || 50);

              const loadedTime = videoProgress[video.id]?.currentTime || 0;
              const loadedDuration =
                videoProgress[video.id]?.duration ||
                event.target.getDuration() ||
                0;

              setVideoProgress((prev) => ({
                ...prev,
                [video.id]: {
                  duration: loadedDuration,
                  currentTime: loadedTime,
                },
              }));

              if (loadedTime > 0) {
                event.target.seekTo(loadedTime, true);
              }
              // Add this line to ensure the video is paused on load
              event.target.pauseVideo();
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                setNowPlaying((prev) => [...new Set([...prev, video.id])]);
              } else if (
                event.data === window.YT.PlayerState.PAUSED ||
                event.data === window.YT.PlayerState.ENDED
              ) {
                setNowPlaying((prev) => prev.filter((id) => id !== video.id));

                // Auto-restart when the video ends
                if (event.data === window.YT.PlayerState.ENDED) {
                  setTimeout(() => {
                    if (
                      event.target &&
                      typeof event.target.seekTo === "function"
                    ) {
                      event.target.seekTo(0, true);
                      event.target.playVideo();
                    }
                  }, 1000); // Small delay before restarting
                }
              }
            },
          },
        });
      }
    },
    [videoProgress]
  );

  useEffect(() => {
    if (!ytReady) return;

    playerElements.forEach((id) => {
      if (!players.current[id] && document.getElementById(`player-${id}`)) {
        setTimeout(() => {
          const video = videos.find((v) => v.id === id) || { id, volume: 50 };
          createPlayer(video);
        }, 50);
      }
    });
  }, [playerElements, ytReady, createPlayer, videos]);

  useEffect(() => {
    Object.keys(progressIntervals.current).forEach((id) => {
      if (!nowPlaying.includes(id)) {
        clearInterval(progressIntervals.current[id]);
        delete progressIntervals.current[id];
      }
    });

    if (!ytReady || isSeeking) {
      return;
    }

    nowPlaying.forEach((id) => {
      if (!progressIntervals.current[id]) {
        progressIntervals.current[id] = setInterval(() => {
          const player = players.current[id];
          if (
            player &&
            typeof player.getCurrentTime === "function" &&
            typeof player.getDuration === "function"
          ) {
            const newTime = player.getCurrentTime();
            const newDuration = player.getDuration();
            setVideoProgress((prev) => ({
              ...prev,
              [id]: { currentTime: newTime, duration: newDuration },
            }));
          }
        }, 1000);
      }
    });

    return () => {
      Object.values(progressIntervals.current).forEach(clearInterval);
      progressIntervals.current = {};
    };
  }, [nowPlaying, ytReady, isSeeking]);

  // Cleanup players on component unmount
  useEffect(() => {
    return () => {
      Object.keys(players.current).forEach((id) => {
        if (
          players.current[id] &&
          typeof players.current[id].destroy === "function"
        ) {
          players.current[id].destroy();
        }
      });
      players.current = {};
    };
  }, []);

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const formattedMinutes = String(minutes).padStart(2, "0");
    const formattedSeconds = String(remainingSeconds).padStart(2, "0");
    return `${formattedMinutes}:${formattedSeconds}`;
  };

  const extractVideoId = (url) => {
    try {
      const u = new URL(url);
      // Corrected hostname check for YouTube URLs
      if (
        u.hostname.includes("youtube.com") ||
        u.hostname.includes("youtu.be")
      ) {
        if (u.hostname.includes("youtube.com")) {
          if (u.pathname === "/watch") return u.searchParams.get("v");
          if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2];
        } else if (u.hostname.includes("youtu.be")) {
          return u.pathname.slice(1);
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const addVideo = () => {
    const id = extractVideoId(input.trim());
    if (!id) {
      console.warn("Please enter a valid YouTube URL");
      return;
    }
    if (videos.some((v) => v.id === id)) {
      console.warn("This audio is already in your playlist");
      return;
    }

    // Generate a random dark color for this track
    const newColor = generateRandomDarkColor();

    const newVideo = {
      id,
      title: titleInput.trim() || `YouTube Audio ${id}`,
      volume: 50,
    };
    setVideos((v) => [...v, newVideo]);
    setPlayerElements((prev) => [...prev, id]);
    setVideoProgress((prev) => ({
      ...prev,
      [newVideo.id]: { currentTime: 0, duration: 0 },
    }));
    setTrackColors((prev) => ({
      ...prev,
      [newVideo.id]: newColor,
    }));
    setInput("");
    setTitleInput("");
  };

  const removeVideo = (id) => {
    setVideos((v) => v.filter((vid) => vid.id !== id));
    setNowPlaying((prev) => prev.filter((vidId) => vidId !== id));
    setVideoProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[id];
      return newProgress;
    });
    setTrackColors((prev) => {
      const newColors = { ...prev };
      delete newColors[id];
      return newColors;
    });

    if (
      players.current[id] &&
      typeof players.current[id].stopVideo === "function"
    ) {
      players.current[id].stopVideo();
    }
  };

  const togglePlay = (id) => {
    const player = players.current[id];
    if (
      !player ||
      typeof player.getPlayerState !== "function" ||
      typeof player.playVideo !== "function" ||
      typeof player.pauseVideo !== "function"
    ) {
      const videoToPlay = videos.find((v) => v.id === id);
      if (videoToPlay && ytReady) {
        createPlayer(videoToPlay);
        setTimeout(() => {
          const reinitializedPlayer = players.current[id];
          if (
            reinitializedPlayer &&
            typeof reinitializedPlayer.playVideo === "function"
          ) {
            reinitializedPlayer.playVideo();
            setVideoProgress((prev) => ({
              ...prev,
              [id]: {
                ...prev[id],
                duration: reinitializedPlayer.getDuration(),
                currentTime: reinitializedPlayer.getCurrentTime(),
              },
            }));
          }
        }, 500);
      }
      return;
    }

    const state = player.getPlayerState();
    if (state === window.YT.PlayerState.PLAYING) {
      player.pauseVideo();
    } else {
      player.playVideo();
      setVideoProgress((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          duration: player.getDuration(),
          currentTime: player.getCurrentTime(),
        },
      }));
    }
  };

  const updateTitle = (id, newTitle) => {
    setVideos(
      videos.map((video) =>
        video.id === id ? { ...video, title: newTitle } : video
      )
    );
  };

  const updateVolume = (id, newVolume) => {
    setVideos(
      videos.map((video) =>
        video.id === id ? { ...video, volume: newVolume } : video
      )
    );

    const player = players.current[id];
    if (player && typeof player.setVolume === "function") {
      player.setVolume(newVolume);
    } else {
      console.warn(`Cannot set volume for video ID ${id}: player not ready.`);
    }
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = (id, e) => {
    const newTime = parseFloat(e.target.value);
    const player = players.current[id];
    if (player && typeof player.seekTo === "function") {
      player.seekTo(newTime, true);
    }
    setIsSeeking(false);
  };

  const handleSeekChange = (id, e) => {
    const newTime = parseFloat(e.target.value);
    setVideoProgress((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        currentTime: newTime,
      },
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      addVideo();
    }
  };

  const handleOpenModal = () => {
    setVisible(true);
  };

  const handleCloseModal = () => {
    setVisible(false);
  };

  // dnd-kit drag end handler
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setVideos((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Sound effects functionality
  const playSoundEffect = (effectId) => {
    // Stop any currently playing sound effect
    stopSoundEffect();

    // Priority order: Custom sounds > Local files > Online files > Generated sounds

    // Check for custom sound first
    if (customSounds[effectId]) {
      const audio = new Audio(customSounds[effectId]);
      audio.volume = soundEffectVolume / 100; // Convert percentage to 0-1 range
      soundEffectAudio.current = audio;
      setCurrentlyPlayingSound(effectId);

      audio.play().catch((error) => {
        console.log("Custom sound failed, trying fallback:", error);
        playFallbackSound(effectId);
      });

      // Clear the currently playing sound when it ends
      audio.onended = () => {
        setCurrentlyPlayingSound(null);
        soundEffectAudio.current = null;
      };
      return;
    }

    // Map effect IDs to sound file paths
    const soundFiles = {
      crow: "/sounds/crow.mp3",
      footsteps: "/sounds/footsteps.mp3",
      thunder: "/sounds/thunder.mp3",
      fire: "/sounds/fire.mp3",
      sword: "/sounds/sword.mp3",
      magic: "/sounds/magic.mp3",
      door: "/sounds/door.mp3",
      water: "/sounds/water.mp3",
      wind: "/sounds/wind.mp3",
      bell: "/sounds/bell.mp3",
    };

    // Alternative: Use online sound effect URLs
    const onlineSoundFiles = {
      crow: "https://www.soundjay.com/misc/sounds/crow-1.mp3",
      footsteps: "https://www.soundjay.com/misc/sounds/footsteps-1.mp3",
      thunder: "https://www.soundjay.com/misc/sounds/thunder-1.mp3",
      fire: "https://www.soundjay.com/misc/sounds/fire-1.mp3",
      sword: "https://www.soundjay.com/misc/sounds/sword-1.mp3",
      magic: "https://www.soundjay.com/misc/sounds/magic-1.mp3",
      door: "https://www.soundjay.com/misc/sounds/door-1.mp3",
      water: "https://www.soundjay.com/misc/sounds/water-1.mp3",
      wind: "https://www.soundjay.com/misc/sounds/wind-1.mp3",
      bell: "https://www.soundjay.com/misc/sounds/bell-1.mp3",
    };

    // Try local files first, then online files, then generated sounds
    const soundFile = soundFiles[effectId] || onlineSoundFiles[effectId];

    if (soundFile) {
      const audio = new Audio();
      audio.src = soundFile;
      audio.volume = soundEffectVolume / 100; // Convert percentage to 0-1 range
      soundEffectAudio.current = audio;
      setCurrentlyPlayingSound(effectId);

      // Try to play the sound file
      audio.play().catch((error) => {
        console.log("Sound file not found, using generated sound:", error);
        // Fallback to generated sound if file doesn't exist
        playGeneratedSound(effectId);
      });

      // Clear the currently playing sound when it ends
      audio.onended = () => {
        setCurrentlyPlayingSound(null);
        soundEffectAudio.current = null;
      };
    } else {
      // Fallback to generated sound
      playGeneratedSound(effectId);
    }
  };

  // Fallback function for generated sounds
  const playFallbackSound = (effectId) => {
    // Try local/online files, then generated sounds
    playSoundEffect(effectId);
  };

  // Generated sound effects using Web Audio API
  const playGeneratedSound = (effectId) => {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Create a simple sound effect based on the type
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Set volume based on slider (convert percentage to 0-1 range)
    const volumeLevel = soundEffectVolume / 100;

    // Different sound effects based on type
    switch (effectId) {
      case "crow":
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          100,
          audioContext.currentTime + 0.5
        );
        break;
      case "footsteps":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          60,
          audioContext.currentTime + 0.1
        );
        break;
      case "thunder":
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(50, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          30,
          audioContext.currentTime + 1
        );
        break;
      case "fire":
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          120,
          audioContext.currentTime + 0.3
        );
        break;
      case "sword":
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          200,
          audioContext.currentTime + 0.2
        );
        break;
      case "magic":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          600,
          audioContext.currentTime + 0.5
        );
        break;
      case "door":
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          80,
          audioContext.currentTime + 0.8
        );
        break;
      case "water":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          150,
          audioContext.currentTime + 0.4
        );
        break;
      case "wind":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          250,
          audioContext.currentTime + 0.6
        );
        break;
      case "bell":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          600,
          audioContext.currentTime + 0.3
        );
        break;
      default:
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    }

    // Set volume envelope with user-controlled volume
    gainNode.gain.setValueAtTime(0.3 * volumeLevel, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01 * volumeLevel,
      audioContext.currentTime + 0.5
    );

    // Track currently playing sound
    setCurrentlyPlayingSound(effectId);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Clear the currently playing sound when it ends
    setTimeout(() => {
      setCurrentlyPlayingSound(null);
    }, 500);
  };

  return (
    <>
      <button
        className="audio-fab"
        onClick={handleOpenModal}
        title="Open Audio Player"
        aria-label="Open audio player"
      >
        <img src={guitar} alt="Music Player" />
      </button>

      {playerElements.map((id, index) => (
        <div key={`player-container-${id}-${index}`}>
          <div id={`player-${id}`} className="yt-player" />
        </div>
      ))}

      {visible && (
        <div className="audio-overlay" onClick={handleCloseModal}>
          {/* Sound Effects Panel */}
          <div
            className="sound-effects-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Sound Effects</h3>

            {/* Volume Control */}
            <div className="sound-effects-volume">
              <label htmlFor="sound-volume">Volume: {soundEffectVolume}%</label>
              <input
                type="range"
                id="sound-volume"
                min="0"
                max="100"
                value={soundEffectVolume}
                onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                className="volume-slider"
              />
            </div>

            {/* Stop Button */}
            {currentlyPlayingSound && (
              <div className="sound-effects-stop">
                <button
                  onClick={stopSoundEffect}
                  className="stop-sound-btn"
                  title="Stop current sound effect"
                >
                  ⏹ Stop{" "}
                  {
                    SOUND_EFFECTS.find((e) => e.id === currentlyPlayingSound)
                      ?.name
                  }
                </button>
              </div>
            )}

            <div className="sound-effects-grid">
              {SOUND_EFFECTS.map((effect) => (
                <button
                  key={effect.id}
                  className={`sound-effect-btn ${
                    currentlyPlayingSound === effect.id ? "playing" : ""
                  }`}
                  onClick={() => playSoundEffect(effect.id)}
                  title={effect.description}
                  aria-label={effect.description}
                >
                  <span className="sound-effect-emoji">{effect.emoji}</span>
                  <span className="sound-effect-name">{effect.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="audio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter track title (optional)"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyPress={handleKeyPress}
                aria-label="Track title input"
              />
              <input
                type="text"
                placeholder="Paste YouTube URL here..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                aria-label="YouTube URL input"
              />
              <button onClick={addVideo} className="add-button">
                Add
              </button>
            </div>

            {videos.length === 0 ? (
              <p className="no-audio-text">
                Your playlist is empty. Add some YouTube links to get started!
              </p>
            ) : (
              <div className="playlist-container">
                <h3>Your Playlist ({videos.length})</h3>
                <div className="playlist-scroll">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    // Added modifiers here
                    modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
                  >
                    <SortableContext
                      items={videos.map((video) => video.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {videos.map((video, index) => (
                        <SortableItem
                          key={video.id}
                          video={video}
                          nowPlaying={nowPlaying}
                          videoProgress={videoProgress}
                          formatTime={formatTime}
                          updateTitle={updateTitle}
                          updateVolume={updateVolume}
                          togglePlay={togglePlay}
                          removeVideo={removeVideo}
                          handleSeekChange={handleSeekChange}
                          handleSeekStart={handleSeekStart}
                          handleSeekEnd={handleSeekEnd}
                          index={index}
                          trackColors={trackColors}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AudioPlayer;
