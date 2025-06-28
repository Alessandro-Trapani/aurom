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
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
        return { videos: [], videoProgress: {} };
      }
      const loadedState = JSON.parse(serializedState);
      return {
        videos: Array.isArray(loadedState.videos) ? loadedState.videos : [],
        videoProgress:
          typeof loadedState.videoProgress === "object" &&
          loadedState.videoProgress !== null
            ? loadedState.videoProgress
            : {},
      };
    } catch (error) {
      console.error("Error loading state from local storage:", error);
      return { videos: [], videoProgress: {} };
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
  const [isSeeking, setIsSeeking] = useState(false);
  const progressIntervals = useRef({});

  const [playerElements, setPlayerElements] = useState(
    initialLoad.videos.map((v) => v.id)
  );

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
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Error saving state to local storage:", error);
    }
  }, [videos, videoProgress]);

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
                      {videos.map((video) => (
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
