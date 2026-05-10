import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Audiobook, AudiobookTrack } from '@/types/index';
import { fetchAudiobookById, fetchFeaturedAudiobooks, searchAudiobooks } from '@/services/audiobookService';
import AudiobookCard from '@/components/AudiobookCard';
import Seo from '@/components/Seo';
import { ArrowLeft, Calendar, Download, ExternalLink, Gauge, Headphones, Heart, Library, ListMusic, Pause, Play, Radio, RotateCcw, RotateCw, ShieldCheck, SkipBack, SkipForward } from 'lucide-react';
import { createBreadcrumbSchema, toAbsoluteUrl, truncate } from '@/lib/seo';
import { toggleSavedAudiobook as toggleLocalSavedAudiobook, useLocalUserState } from '@/lib/local-user';

const PROGRESS_KEY_PREFIX = 'bitlibrary-audiobook-progress';
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SKIP_SECONDS = 15;
const DESCRIPTION_PREVIEW_LENGTH = 150;

const formatTrackTime = (seconds?: number) => {
  if (!seconds) return 'Audio';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const getProgressKey = (audiobookId: string) => `${PROGRESS_KEY_PREFIX}-${audiobookId}`;

const AudiobookDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audiobook, setAudiobook] = useState<Audiobook | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTrack, setActiveTrack] = useState<AudiobookTrack | null>(null);
  const [audioSourceIndex, setAudioSourceIndex] = useState(0);
  const [audioError, setAudioError] = useState('');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pendingSeekTime, setPendingSeekTime] = useState(0);
  const [resumeNotice, setResumeNotice] = useState('');
  const [suggestedAudiobooks, setSuggestedAudiobooks] = useState<Audiobook[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  ));
  const { state: localUserState } = useLocalUserState();
  const lastProgressSaveAt = useRef(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    fetchAudiobookById(id)
      .then((result) => {
        if (!active) return;
        setAudiobook(result);
        let nextTrack = result?.tracks[0] || null;
        let nextSeekTime = 0;
        let nextPlaybackRate = 1;

        if (result && typeof window !== 'undefined') {
          try {
            const progress = JSON.parse(window.localStorage.getItem(getProgressKey(result.id)) || 'null') as {
              trackId?: string;
              currentTime?: number;
              playbackRate?: number;
            } | null;
            const savedTrack = result.tracks.find((track) => track.id === progress?.trackId);
            if (savedTrack) {
              nextTrack = savedTrack;
              nextSeekTime = Math.max(0, Number(progress?.currentTime) || 0);
              nextPlaybackRate = PLAYBACK_RATES.includes(Number(progress?.playbackRate)) ? Number(progress?.playbackRate) : 1;
              if (nextSeekTime > 5) {
                setResumeNotice(`Resumed chapter ${savedTrack.sectionNumber} at ${formatTrackTime(Math.floor(nextSeekTime))}.`);
              }
            } else {
              setResumeNotice('');
            }
          } catch {
            setResumeNotice('');
          }
        }

        setActiveTrack(nextTrack);
        setPendingSeekTime(nextSeekTime);
        setPlaybackRate(nextPlaybackRate);
        setAudioSourceIndex(0);
        setAudioError('');
        setDescriptionExpanded(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!audiobook) return;
    let active = true;

    const loadSuggestions = async () => {
      setSuggestedLoading(true);
      try {
        const [byAuthorResult, featuredResult] = await Promise.allSettled([
          audiobook.author ? searchAudiobooks(audiobook.author, 8) : Promise.resolve([]),
          fetchFeaturedAudiobooks(8),
        ]);
        const byAuthor = byAuthorResult.status === 'fulfilled' ? byAuthorResult.value : [];
        const featured = featuredResult.status === 'fulfilled' ? featuredResult.value : [];

        const merged = [...byAuthor, ...featured]
          .filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index)
          .filter((item) => item.id !== audiobook.id)
          .slice(0, 4);

        if (active) setSuggestedAudiobooks(merged);
      } finally {
        if (active) setSuggestedLoading(false);
      }
    };

    void loadSuggestions();

    return () => {
      active = false;
    };
  }, [audiobook]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = () => setIsDesktopViewport(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    setAudioSourceIndex(0);
    setAudioError('');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPendingSeekTime(0);
  }, [activeTrack?.id]);

  const activeAudioUrls = activeTrack ? (activeTrack.fallbackUrls?.length ? activeTrack.fallbackUrls : [activeTrack.listenUrl]) : [];
  const activeAudioUrl = activeAudioUrls[audioSourceIndex] || activeTrack?.listenUrl || '';
  const activeTrackIndex = audiobook && activeTrack ? audiobook.tracks.findIndex((track) => track.id === activeTrack.id) : -1;
  const hasPreviousTrack = Boolean(audiobook && activeTrackIndex > 0);
  const hasNextTrack = Boolean(audiobook && activeTrackIndex >= 0 && activeTrackIndex < audiobook.tracks.length - 1);
  const description = audiobook?.description || '';
  const hasLongDescription = description.length >= DESCRIPTION_PREVIEW_LENGTH;
  const visibleDescription = descriptionExpanded || !hasLongDescription
    ? description
    : `${description.slice(0, DESCRIPTION_PREVIEW_LENGTH).trim()}...`;
  const isSaved = Boolean(audiobook && localUserState.savedAudiobooks.some((item) => item.id === audiobook.id));

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, activeAudioUrl]);

  const handleAudioError = () => {
    if (audioSourceIndex < activeAudioUrls.length - 1) {
      setAudioSourceIndex((current) => current + 1);
      setAudioError('The archive host paused this stream. Trying another source...');
      return;
    }

    setAudioError('This archive audio host is not responding right now. Try another chapter or open the source track.');
  };
  const persistProgress = (time: number) => {
    if (!audiobook || !activeTrack || typeof window === 'undefined') return;
    window.localStorage.setItem(getProgressKey(audiobook.id), JSON.stringify({
      trackId: activeTrack.id,
      currentTime: time,
      playbackRate,
      updatedAt: Date.now(),
    }));
  };
  const selectTrack = (track: AudiobookTrack) => {
    setResumeNotice('');
    setPendingSeekTime(0);
    setActiveTrack(track);
    if (audiobook && typeof window !== 'undefined') {
      window.localStorage.setItem(getProgressKey(audiobook.id), JSON.stringify({
        trackId: track.id,
        currentTime: 0,
        playbackRate,
        updatedAt: Date.now(),
      }));
    }
  };
  const changeTrack = (direction: -1 | 1) => {
    if (!audiobook || activeTrackIndex < 0) return;
    const nextTrack = audiobook.tracks[activeTrackIndex + direction];
    if (nextTrack) selectTrack(nextTrack);
  };
  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setAudioError('Playback could not start yet. Open the current track or try another chapter.');
      }
      return;
    }

    audio.pause();
    setIsPlaying(false);
  };
  const handleSeek = (value: string) => {
    const audio = audioRef.current;
    const nextTime = Number(value);
    setCurrentTime(nextTime);
    if (audio && Number.isFinite(nextTime)) {
      audio.currentTime = nextTime;
      persistProgress(nextTime);
    }
  };
  const skipBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const maxTime = duration || activeTrack?.playtimeSeconds || audio.duration || 0;
    const nextTime = Math.min(Math.max(audio.currentTime + seconds, 0), maxTime || Number.MAX_SAFE_INTEGER);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    persistProgress(nextTime);
  };
  const handlePlaybackRateChange = (value: string) => {
    const nextRate = Number(value);
    if (!PLAYBACK_RATES.includes(nextRate)) return;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
    persistProgress(currentTime);
  };
  const toggleSavedAudiobook = () => {
    if (!audiobook) return;
    toggleLocalSavedAudiobook(audiobook);
  };

  const structuredData = useMemo(() => {
    if (!audiobook) return [];
    return [
      createBreadcrumbSchema([
        { name: 'BitLibrary', path: '/' },
        { name: 'Audiobooks', path: '/audiobooks' },
        { name: audiobook.title, path: `/audiobook/${audiobook.id}` },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'Audiobook',
        name: audiobook.title,
        url: toAbsoluteUrl(`/audiobook/${audiobook.id}`),
        author: audiobook.authors.map((author) => ({ '@type': 'Person', name: author.name })),
        readBy: audiobook.tracks.flatMap((track) => track.readers).slice(0, 8).map((reader) => ({ '@type': 'Person', name: reader })),
        duration: audiobook.totalTime,
        inLanguage: audiobook.language,
        isAccessibleForFree: true,
        provider: { '@type': 'Organization', name: 'LibriVox', url: 'https://librivox.org' },
        sameAs: audiobook.librivoxUrl,
      },
    ];
  }, [audiobook]);

  if (loading) {
    return (
      <div className="animate-fade-in pb-24">
        <div className="h-[34rem] rounded-[2.5rem] border border-bit-border bg-bit-panel/30 animate-shimmer" />
      </div>
    );
  }

  if (!audiobook) {
    return (
      <div className="py-24 text-center">
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-bit-muted">Audiobook node not found.</p>
        <button onClick={() => navigate('/audiobooks')} className="mt-6 rounded-full bg-bit-accent px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-white">
          Back to audiobooks
        </button>
      </div>
    );
  }

  const coverUrl = audiobook.coverUrl || audiobook.thumbnailUrl;
  const displayCoverUrl = coverUrl
    ? `https://images.weserv.nl/?url=${encodeURIComponent(coverUrl)}&w=640&h=860&fit=cover&output=webp`
    : null;

  return (
    <div className="animate-fade-in pb-24">
      <Seo
        title={`${audiobook.title} Audiobook | BitLibrary`}
        description={truncate(`${audiobook.description} Listen to this public-domain LibriVox audiobook on BitLibrary.`, 155)}
        canonicalPath={`/audiobook/${audiobook.id}`}
        image={coverUrl}
        keywords={[audiobook.title, audiobook.author, 'LibriVox', 'public domain audiobook', ...audiobook.genres].filter(Boolean)}
        structuredData={structuredData}
      />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/audiobooks')}
          className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/30 px-6 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-muted shadow-sm transition-all hover:border-bit-accent/30 hover:text-bit-accent"
        >
          <ArrowLeft size={14} />
          Back to Audiobooks
        </button>

        <button
          type="button"
          onClick={toggleSavedAudiobook}
          className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] shadow-sm transition-all ${
            isSaved
              ? 'border-bit-accent bg-bit-accent text-white shadow-bit-accent/20'
              : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:border-bit-accent/30 hover:text-bit-accent'
          }`}
          aria-label={isSaved ? 'Remove audiobook from saved' : 'Save audiobook'}
        >
          <Heart size={14} className={isSaved ? 'fill-current' : ''} />
          {isSaved ? 'Saved' : 'Save Audio'}
        </button>
      </div>

      <article className="grid min-w-0 gap-8 lg:grid-cols-[minmax(14rem,19rem)_1fr] xl:grid-cols-[minmax(15rem,21rem)_1fr]">
        <section className="min-w-0 lg:sticky lg:top-24 lg:h-fit">
          <div className="mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-bit-border bg-bit-panel/35 shadow-2xl lg:max-w-[19rem] xl:max-w-[21rem] lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto">
            <div className="relative aspect-[3/4] max-h-[54svh] bg-bit-panel/40 lg:max-h-[24rem]">
              {displayCoverUrl ? (
                <img src={displayCoverUrl} alt={audiobook.title} className="h-full w-full object-cover opacity-80" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Headphones size={64} className="text-bit-accent/70" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-bit-bg via-bit-bg/25 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/80 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-bit-accent backdrop-blur-md">
                  <Radio size={12} />
                  LibriVox public domain
                </p>
                <h1 className="text-3xl font-display font-bold leading-tight text-white md:text-4xl lg:text-2xl xl:text-3xl">{audiobook.title}</h1>
                <p className="mt-4 text-lg text-white/70 lg:text-sm xl:text-base">by {audiobook.author}</p>
              </div>
            </div>

            <section className="hidden border-t border-bit-border bg-bit-panel/25 p-5 lg:block">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-lg font-display font-bold text-bit-text">About this recording</h2>
                <ShieldCheck size={18} className="text-bit-accent" />
              </div>
              <p className="text-sm leading-7 text-bit-muted">{visibleDescription}</p>
              {hasLongDescription && (
                <button
                  type="button"
                  onClick={() => setDescriptionExpanded((value) => !value)}
                  className="mt-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent transition-colors hover:text-bit-text"
                >
                  {descriptionExpanded ? 'Show less' : 'Show more'}
                </button>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {audiobook.zipUrl && (
                  <a href={audiobook.zipUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-bit-accent/30 bg-bit-accent/10 px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-bit-accent transition-all hover:bg-bit-accent hover:text-white">
                    <Download size={12} />
                    Download
                  </a>
                )}
                <a href={audiobook.librivoxUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/40 px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent">
                  <ExternalLink size={12} />
                  Source
                </a>
                {audiobook.sourceTextUrl && (
                  <a href={audiobook.sourceTextUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/40 px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent">
                    <Calendar size={12} />
                    Text
                  </a>
                )}
              </div>
            </section>

            {activeTrack && !isDesktopViewport && (
              <div className="border-t border-bit-border bg-bit-panel/35 p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent">Now playing</p>
                    <p className="truncate text-sm font-semibold text-bit-text">{activeTrack.sectionNumber}. {activeTrack.title}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-bit-border bg-bit-bg/50 px-2.5 py-1 text-[10px] font-mono text-bit-muted">
                    {activeTrackIndex + 1}/{audiobook.tracks.length}
                  </span>
                </div>
                <audio
                  ref={audioRef}
                  key={`${activeTrack.id}-${audioSourceIndex}`}
                  preload="metadata"
                  src={activeAudioUrl}
                  onCanPlay={() => setAudioError('')}
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || activeTrack.playtimeSeconds || 0)}
                  onLoadedData={(event) => {
                    event.currentTarget.playbackRate = playbackRate;
                    if (pendingSeekTime > 0 && pendingSeekTime < (event.currentTarget.duration || Number.MAX_SAFE_INTEGER)) {
                      event.currentTarget.currentTime = pendingSeekTime;
                      setCurrentTime(pendingSeekTime);
                      setPendingSeekTime(0);
                    }
                  }}
                  onTimeUpdate={(event) => {
                    const nextTime = event.currentTarget.currentTime;
                    setCurrentTime(nextTime);
                    if (Date.now() - lastProgressSaveAt.current > 2000) {
                      lastProgressSaveAt.current = Date.now();
                      persistProgress(nextTime);
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => {
                    setIsPlaying(false);
                    if (hasNextTrack) changeTrack(1);
                  }}
                  onError={handleAudioError}
                >
                  <a href={activeAudioUrl}>Open audio track</a>
                </audio>
                <div className="rounded-[1.5rem] border border-bit-border bg-bit-bg/35 p-4">
                  <div className="mb-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeTrack(-1)}
                      disabled={!hasPreviousTrack}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-bit-border bg-bit-panel/40 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Previous chapter"
                      title="Previous chapter"
                    >
                      <SkipBack size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => skipBy(-SKIP_SECONDS)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-bit-border bg-bit-panel/50 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Skip back 15 seconds"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={togglePlayback}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-bit-accent text-white shadow-lg shadow-bit-accent/30 transition-transform hover:scale-105 active:scale-95"
                      aria-label={isPlaying ? 'Pause audiobook' : 'Play audiobook'}
                    >
                      {isPlaying ? <Pause size={24} className="fill-current" /> : <Play size={24} className="ml-1 fill-current" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => skipBy(SKIP_SECONDS)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-bit-border bg-bit-panel/50 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Skip forward 15 seconds"
                    >
                      <RotateCw size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => changeTrack(1)}
                      disabled={!hasNextTrack}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-bit-border bg-bit-panel/40 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Next chapter"
                      title="Next chapter"
                    >
                      <SkipForward size={15} />
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || activeTrack.playtimeSeconds || 0}
                    value={Math.min(currentTime, duration || activeTrack.playtimeSeconds || currentTime || 0)}
                    onChange={(event) => handleSeek(event.target.value)}
                    className="w-full accent-bit-accent"
                    aria-label="Audio progress"
                  />
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-bit-muted">
                    <span>{formatTrackTime(Math.floor(currentTime))}</span>
                    <span>{formatTrackTime(Math.floor(duration || activeTrack.playtimeSeconds || 0))}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-bit-muted">
                        <ListMusic size={12} className="text-bit-accent" />
                        Chapter
                      </span>
                      <select
                        value={activeTrack.id}
                        onChange={(event) => {
                          const nextTrack = audiobook.tracks.find((track) => track.id === event.target.value);
                          if (nextTrack) selectTrack(nextTrack);
                        }}
                        className="w-full rounded-xl border border-bit-border bg-bit-panel/60 px-3 py-2 text-sm text-bit-text focus:border-bit-accent/40 focus:outline-none"
                      >
                        {audiobook.tracks.map((track) => (
                          <option key={track.id} value={track.id}>
                            {track.sectionNumber}. {track.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-bit-muted">
                        <Gauge size={12} className="text-bit-accent" />
                        Speed
                      </span>
                      <select
                        value={playbackRate}
                        onChange={(event) => handlePlaybackRateChange(event.target.value)}
                        className="w-full rounded-xl border border-bit-border bg-bit-panel/60 px-3 py-2 text-sm text-bit-text focus:border-bit-accent/40 focus:outline-none"
                      >
                        {PLAYBACK_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}x
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {resumeNotice && (
                    <p className="text-xs leading-6 text-bit-muted">{resumeNotice}</p>
                  )}
                  {audioError && (
                    <p className="text-xs leading-6 text-bit-muted">{audioError}</p>
                  )}
                  <a
                    href={activeAudioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent hover:text-bit-text"
                  >
                    Open current track
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0 space-y-8">
          <nav className="flex items-center gap-3 overflow-x-auto border-b border-bit-border pb-4 text-[10px] font-mono uppercase tracking-[0.2em]">
            <button onClick={() => navigate('/library')} className="inline-flex items-center gap-2 text-bit-muted hover:text-bit-accent">
              <Library size={12} />
              Library
            </button>
            <span className="text-bit-muted/30">/</span>
            <button onClick={() => navigate('/audiobooks')} className="text-bit-muted hover:text-bit-accent">Audiobooks</button>
            <span className="text-bit-muted/30">/</span>
            <span className="text-bit-accent">{audiobook.title.length > 30 ? `${audiobook.title.slice(0, 30)}...` : audiobook.title}</span>
          </nav>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-bit-border bg-bit-panel/30 p-4">
              <p className="text-[10px] font-mono uppercase text-bit-muted">Duration</p>
              <p className="mt-1 text-xl font-display font-bold text-bit-text">{audiobook.totalTime || 'Open'}</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-panel/30 p-4">
              <p className="text-[10px] font-mono uppercase text-bit-muted">Tracks</p>
              <p className="mt-1 text-xl font-display font-bold text-bit-text">{audiobook.numSections}</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-panel/30 p-4">
              <p className="text-[10px] font-mono uppercase text-bit-muted">Language</p>
              <p className="mt-1 text-xl font-display font-bold text-bit-text">{audiobook.language}</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-panel/30 p-4">
              <p className="text-[10px] font-mono uppercase text-bit-muted">Year</p>
              <p className="mt-1 text-xl font-display font-bold text-bit-text">{audiobook.copyrightYear || 'PD'}</p>
            </div>
          </div>

          {activeTrack && isDesktopViewport && (
            <section className="rounded-[2rem] border border-bit-border bg-bit-panel/30 p-7">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent">Now playing</p>
                  <h2 className="truncate text-2xl font-display font-bold text-bit-text">{activeTrack.sectionNumber}. {activeTrack.title}</h2>
                </div>
                <span className="shrink-0 rounded-full border border-bit-border bg-bit-bg/50 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-bit-muted">
                  {activeTrackIndex + 1}/{audiobook.tracks.length}
                </span>
              </div>

              <audio
                ref={audioRef}
                key={`desktop-${activeTrack.id}-${audioSourceIndex}`}
                preload="metadata"
                src={activeAudioUrl}
                onCanPlay={() => setAudioError('')}
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || activeTrack.playtimeSeconds || 0)}
                onLoadedData={(event) => {
                  event.currentTarget.playbackRate = playbackRate;
                  if (pendingSeekTime > 0 && pendingSeekTime < (event.currentTarget.duration || Number.MAX_SAFE_INTEGER)) {
                    event.currentTarget.currentTime = pendingSeekTime;
                    setCurrentTime(pendingSeekTime);
                    setPendingSeekTime(0);
                  }
                }}
                onTimeUpdate={(event) => {
                  const nextTime = event.currentTarget.currentTime;
                  setCurrentTime(nextTime);
                  if (Date.now() - lastProgressSaveAt.current > 2000) {
                    lastProgressSaveAt.current = Date.now();
                    persistProgress(nextTime);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  if (hasNextTrack) changeTrack(1);
                }}
                onError={handleAudioError}
              >
                <a href={activeAudioUrl}>Open audio track</a>
              </audio>

              <div className="rounded-[1.5rem] border border-bit-border bg-bit-bg/35 p-5">
                <div className="mb-5 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => skipBy(-SKIP_SECONDS)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-bit-border bg-bit-panel/50 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Skip back 15 seconds"
                  >
                    <RotateCcw size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeTrack(-1)}
                    disabled={!hasPreviousTrack}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-bit-border bg-bit-panel/40 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Previous chapter"
                    title="Previous chapter"
                  >
                    <SkipBack size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlayback}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-bit-accent text-white shadow-lg shadow-bit-accent/30 transition-transform hover:scale-105 active:scale-95"
                    aria-label={isPlaying ? 'Pause audiobook' : 'Play audiobook'}
                  >
                    {isPlaying ? <Pause size={27} className="fill-current" /> : <Play size={27} className="ml-1 fill-current" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => skipBy(SKIP_SECONDS)}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-bit-border bg-bit-panel/50 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Skip forward 15 seconds"
                  >
                    <RotateCw size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeTrack(1)}
                    disabled={!hasNextTrack}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-bit-border bg-bit-panel/40 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Next chapter"
                    title="Next chapter"
                  >
                    <SkipForward size={15} />
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || activeTrack.playtimeSeconds || 0}
                  value={Math.min(currentTime, duration || activeTrack.playtimeSeconds || currentTime || 0)}
                  onChange={(event) => handleSeek(event.target.value)}
                  className="w-full accent-bit-accent"
                  aria-label="Audio progress"
                />
                <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-bit-muted">
                  <span>{formatTrackTime(Math.floor(currentTime))}</span>
                  <span>{formatTrackTime(Math.floor(duration || activeTrack.playtimeSeconds || 0))}</span>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_10rem]">
                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-bit-muted">
                      <ListMusic size={12} className="text-bit-accent" />
                      Jump to chapter
                    </span>
                    <select
                      value={activeTrack.id}
                      onChange={(event) => {
                        const nextTrack = audiobook.tracks.find((track) => track.id === event.target.value);
                        if (nextTrack) selectTrack(nextTrack);
                      }}
                      className="w-full rounded-xl border border-bit-border bg-bit-panel/60 px-3 py-2.5 text-sm text-bit-text focus:border-bit-accent/40 focus:outline-none"
                    >
                      {audiobook.tracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.sectionNumber}. {track.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-bit-muted">
                      <Gauge size={12} className="text-bit-accent" />
                      Speed
                    </span>
                    <select
                      value={playbackRate}
                      onChange={(event) => handlePlaybackRateChange(event.target.value)}
                      className="w-full rounded-xl border border-bit-border bg-bit-panel/60 px-3 py-2.5 text-sm text-bit-text focus:border-bit-accent/40 focus:outline-none"
                    >
                      {PLAYBACK_RATES.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}x
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {resumeNotice && (
                  <p className="text-xs leading-6 text-bit-muted">{resumeNotice}</p>
                )}
                {audioError && (
                  <p className="text-xs leading-6 text-bit-muted">{audioError}</p>
                )}
                <a
                  href={activeAudioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent hover:text-bit-text"
                >
                  Open current track
                </a>
              </div>
            </section>
          )}

          <section className="rounded-[2rem] border border-bit-border bg-bit-panel/30 p-7 lg:hidden">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-display font-bold text-bit-text">About this recording</h2>
              <ShieldCheck size={20} className="text-bit-accent" />
            </div>
            <p className="text-base leading-8 text-bit-muted">{visibleDescription}</p>
            {hasLongDescription && (
              <button
                type="button"
                onClick={() => setDescriptionExpanded((value) => !value)}
                className="mt-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent transition-colors hover:text-bit-text"
              >
                {descriptionExpanded ? 'Show less' : 'Show more'}
              </button>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              {audiobook.zipUrl && (
                <a href={audiobook.zipUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-bit-accent/30 bg-bit-accent/10 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-bit-accent transition-all hover:bg-bit-accent hover:text-white">
                  <Download size={13} />
                  Download audio
                </a>
              )}
              <a href={audiobook.librivoxUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/40 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent">
                <ExternalLink size={13} />
                Source page
              </a>
              {audiobook.sourceTextUrl && (
                <a href={audiobook.sourceTextUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/40 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent">
                  <Calendar size={13} />
                  Source text
                </a>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-bit-border bg-bit-panel/30 p-4 sm:p-6 lg:p-7">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-display font-bold text-bit-text">Chapter audio</h2>
              <ListMusic size={20} className="text-bit-accent" />
            </div>
            <div className="max-h-[38rem] space-y-2 overflow-y-auto pr-1">
              {audiobook.tracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => selectTrack(track)}
                  className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all ${
                    activeTrack?.id === track.id
                      ? 'border-bit-accent/40 bg-bit-accent/10 text-bit-text'
                      : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:border-bit-accent/30 hover:text-bit-text'
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-bit-border bg-bit-bg/50 text-[10px] font-mono text-bit-accent">
                    {activeTrack?.id === track.id ? <Play size={13} className="fill-current" /> : track.sectionNumber}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{track.title}</span>
                    <span className="mt-1 block truncate text-[10px] font-mono uppercase tracking-widest opacity-60">
                      {track.readers.length ? track.readers.join(', ') : 'LibriVox volunteer'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest opacity-60">{formatTrackTime(track.playtimeSeconds)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-bit-border bg-bit-panel/30 p-7">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent">Suggested listening</p>
                <h2 className="mt-2 text-2xl font-display font-bold text-bit-text">More audiobooks to try</h2>
              </div>
              {suggestedLoading && (
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-muted">Finding matches...</span>
              )}
            </div>

            {suggestedAudiobooks.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.25rem),1fr))] gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fit,minmax(10.25rem,1fr))] lg:grid-cols-4 lg:gap-x-5">
                {suggestedAudiobooks.map((item) => (
                  <AudiobookCard
                    key={item.id}
                    audiobook={item}
                    variant="compact"
                    onClick={(nextAudiobook) => navigate(`/audiobook/${nextAudiobook.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-bit-border bg-bit-panel/20 p-6 text-sm leading-7 text-bit-muted">
                Suggestions will appear here when the audio catalog is reachable.
              </div>
            )}
          </section>
        </section>
      </article>
    </div>
  );
};

export default AudiobookDetails;
