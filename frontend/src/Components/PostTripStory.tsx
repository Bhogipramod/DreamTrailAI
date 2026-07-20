import React, { useEffect, useRef, useState } from 'react';
import { ItineraryDay, Destination, TripRequest, DayNote, PhotoPayload, Story, StoryStyle } from '../types';
import { generatePostTripStory } from '../api';
import { resizeImageToPhotoPayload } from '../imageUtils';

interface DayPhotoFile {
  id: string;
  file: File;
  previewUrl: string;
}

interface DayEntry {
  photos: DayPhotoFile[];
  caption: string;
}

interface ExtraPhoto {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
}

interface PostTripStoryProps {
  destination: Destination;
  itinerary: ItineraryDay[];
  tripRequest: TripRequest;
}

const MAX_PHOTOS_PER_DAY = 6;
const MAX_EXTRA_PHOTOS = 6;
const STORY_STYLES: StoryStyle[] = ['documentary', 'watercolor', 'cinematic', 'fantasy', 'animation'];

// How many photos actually get resized + sent to the AI when vision
// analysis is turned on. Capped well below the upload limits above -
// image tokens cost far more than text, so this bounds cost regardless
// of how many photos the user uploaded.
const MAX_IMAGES_PER_DAY_FOR_AI = 2;
const MAX_EXTRA_IMAGES_FOR_AI = 2;

function defaultCaptionForDay(destination: Destination, day: ItineraryDay): string {
  // Derived entirely from data already generated for this trip (itinerary
  // day theme) - no AI call, no image analysis, no EXIF/location reads.
  return `Day ${day.day}: ${day.theme} in ${destination.name}`;
}

export const PostTripStory: React.FC<PostTripStoryProps> = ({ destination, itinerary, tripRequest }) => {
  // One entry per itinerary day, keyed by day number - each can hold several photos.
  const [dayEntries, setDayEntries] = useState<Record<number, DayEntry>>({});
  const [extraPhotos, setExtraPhotos] = useState<ExtraPhoto[]>([]);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const extraInputRef = useRef<HTMLInputElement>(null);

  const [storyStyle, setStoryStyle] = useState<StoryStyle>('documentary');
  const [includePhotosInStory, setIncludePhotosInStory] = useState(false);
  const [tripStory, setTripStory] = useState<Story | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState('');
  const [storyError, setStoryError] = useState<string | null>(null);

  // Revoke every object URL on unmount to avoid leaking memory.
  useEffect(() => {
    return () => {
      Object.values(dayEntries).forEach((entry) => entry.photos.forEach((p) => URL.revokeObjectURL(p.previewUrl)));
      extraPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDayFilesSelected = (day: ItineraryDay, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setDayEntries((prev) => {
      const existing = prev[day.day] ?? { photos: [], caption: defaultCaptionForDay(destination, day) };
      const room = Math.max(0, MAX_PHOTOS_PER_DAY - existing.photos.length);
      const accepted = files.slice(0, room);
      const newPhotos: DayPhotoFile[] = accepted.map((file, idx) => ({
        id: `${Date.now()}-${idx}-${file.name}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return {
        ...prev,
        [day.day]: { ...existing, photos: [...existing.photos, ...newPhotos] },
      };
    });
    e.target.value = '';
  };

  const updateDayCaption = (dayNumber: number, caption: string) => {
    setDayEntries((prev) => ({
      ...prev,
      [dayNumber]: { ...prev[dayNumber], caption },
    }));
  };

  const removeDayPhoto = (dayNumber: number, photoId: string) => {
    setDayEntries((prev) => {
      const entry = prev[dayNumber];
      if (!entry) return prev;
      const target = entry.photos.find((p) => p.id === photoId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const remainingPhotos = entry.photos.filter((p) => p.id !== photoId);
      if (remainingPhotos.length === 0) {
        const next = { ...prev };
        delete next[dayNumber];
        return next;
      }
      return { ...prev, [dayNumber]: { ...entry, photos: remainingPhotos } };
    });
  };

  const handleExtraFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const room = Math.max(0, MAX_EXTRA_PHOTOS - extraPhotos.length);
    const accepted = files.slice(0, room);

    const newPhotos: ExtraPhoto[] = accepted.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: `A moment from ${destination.name}`,
    }));

    setExtraPhotos((prev) => [...prev, ...newPhotos]);
    if (extraInputRef.current) extraInputRef.current.value = '';
  };

  const updateExtraCaption = (id: string, caption: string) => {
    setExtraPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
  };

  const removeExtraPhoto = (id: string) => {
    setExtraPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleCopyCaptionPack = async () => {
    const orderedDayCaptions = itinerary
      .map((day) => dayEntries[day.day]?.caption)
      .filter((c): c is string => Boolean(c));
    const extraCaptions = extraPhotos.map((p) => p.caption).filter(Boolean);
    const pack = [...orderedDayCaptions, ...extraCaptions].join('\n\n');
    if (!pack) return;
    try {
      await navigator.clipboard.writeText(pack);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    setTimeout(() => setCopyStatus('idle'), 2500);
  };

  const totalPhotosUploaded =
    Object.values(dayEntries).reduce((sum, entry) => sum + entry.photos.length, 0) + extraPhotos.length;

  const handleGenerateStory = async () => {
    setIsGeneratingStory(true);
    setStoryError(null);
    try {
      let dayNotes: DayNote[];
      let extraNotesPayload: string[] = extraPhotos.map((p) => p.caption).filter(Boolean);
      let extraPhotosPayload: PhotoPayload[] = [];

      if (includePhotosInStory) {
        setGeneratingStatus('Preparing photos...');
        dayNotes = await Promise.all(
          itinerary
            .filter((day) => dayEntries[day.day]?.caption)
            .map(async (day) => {
              const entry = dayEntries[day.day];
              const photosToSend = entry.photos.slice(0, MAX_IMAGES_PER_DAY_FOR_AI);
              const resized = await Promise.all(photosToSend.map((p) => resizeImageToPhotoPayload(p.file)));
              return { day: day.day, theme: day.theme, caption: entry.caption, photos: resized };
            }),
        );
        const extrasToResize = extraPhotos.slice(0, MAX_EXTRA_IMAGES_FOR_AI);
        extraPhotosPayload = await Promise.all(extrasToResize.map((p) => resizeImageToPhotoPayload(p.file)));
      } else {
        dayNotes = itinerary
          .filter((day) => dayEntries[day.day]?.caption)
          .map((day) => ({ day: day.day, theme: day.theme, caption: dayEntries[day.day].caption, photos: [] }));
      }

      setGeneratingStatus('Writing your story...');
      const story = await generatePostTripStory(tripRequest, dayNotes, extraNotesPayload, extraPhotosPayload, storyStyle);
      setTripStory(story);
    } catch (err: any) {
      setStoryError(err.message || 'Could not write your trip story. Please try again.');
    } finally {
      setIsGeneratingStory(false);
      setGeneratingStatus('');
    }
  };

  const hasAnyPhoto = Object.keys(dayEntries).length > 0 || extraPhotos.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/30 border border-slate-800/70 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-slate-200">📸 Post-Trip Memory Story</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-lg">
          Add a few photos to each day of your trip — we'll suggest one caption per day from your
          itinerary. Everything here stays in this browser tab unless you turn on photo analysis below.
        </p>
      </div>

      {/* One entry per itinerary day, each holding multiple photos */}
      <div className="grid grid-cols-1 gap-6 max-w-2xl mx-auto">
        {itinerary.map((day) => {
          const entry = dayEntries[day.day];
          const photos = entry?.photos ?? [];
          const canAddMore = photos.length < MAX_PHOTOS_PER_DAY;

          return (
            <div key={day.day} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-emerald-400 font-bold">
                    Day {day.day}
                  </span>
                  <p className="text-xs text-slate-400">{day.theme}</p>
                </div>
                <span className="text-[10px] text-slate-500">{photos.length}/{MAX_PHOTOS_PER_DAY} photos</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-950 group">
                    <img src={photo.previewUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeDayPhoto(day.day, photo.id)}
                      className="absolute top-1 right-1 bg-slate-950/80 text-rose-400 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition focus:outline-none focus:ring-2 focus:ring-rose-400"
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {canAddMore && (
                  <label
                    htmlFor={`upload-day-${day.day}`}
                    className="aspect-square flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer hover:border-emerald-500 hover:bg-slate-900/60 transition"
                  >
                    <span className="text-lg text-slate-600">+</span>
                    <span className="text-[9px] text-slate-500 text-center px-1">Add photos</span>
                    <input
                      id={`upload-day-${day.day}`}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleDayFilesSelected(day, e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {photos.length > 0 && (
                <div>
                  <label htmlFor={`caption-day-${day.day}`} className="sr-only">Caption for day {day.day}</label>
                  <textarea
                    id={`caption-day-${day.day}`}
                    value={entry.caption}
                    onChange={(e) => updateDayCaption(day.day, e.target.value)}
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Optional extra photos not tied to a specific day */}
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Other Photos (not tied to a day)
          </h4>
          <label
            htmlFor="extra-upload"
            className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition whitespace-nowrap ${
              extraPhotos.length >= MAX_EXTRA_PHOTOS
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200'
            }`}
          >
            {extraPhotos.length >= MAX_EXTRA_PHOTOS ? 'Max reached' : '+ Add'}
            <input
              id="extra-upload"
              ref={extraInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleExtraFilesSelected}
              disabled={extraPhotos.length >= MAX_EXTRA_PHOTOS}
              className="hidden"
            />
          </label>
        </div>

        {extraPhotos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {extraPhotos.map((photo) => (
              <div key={photo.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="aspect-[4/5] bg-slate-950">
                  <img src={photo.previewUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="p-3 space-y-2">
                  <label htmlFor={`caption-extra-${photo.id}`} className="sr-only">Caption</label>
                  <textarea
                    id={`caption-extra-${photo.id}`}
                    value={photo.caption}
                    onChange={(e) => updateExtraCaption(photo.id, e.target.value)}
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  />
                  <button
                    onClick={() => removeExtraPhoto(photo.id)}
                    className="text-[10px] uppercase tracking-wide text-rose-400 hover:text-rose-300 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-400 rounded px-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasAnyPhoto && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleCopyCaptionPack}
              className="text-sm bg-slate-900 border border-slate-700 hover:border-slate-600 px-5 py-2.5 rounded-lg font-semibold text-slate-200 transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              📋 Copy Caption Pack
            </button>
            {copyStatus === 'copied' && (
              <span role="status" className="text-xs text-emerald-400">Copied — paste it into your post.</span>
            )}
            {copyStatus === 'error' && (
              <span role="alert" className="text-xs text-rose-400">Couldn't copy automatically — select and copy the captions manually.</span>
            )}
          </div>

          <div className="border-t border-slate-800/70 pt-4 space-y-3">
            <label className="flex items-start gap-2 text-xs text-slate-400 cursor-pointer max-w-md mx-auto">
              <input
                type="checkbox"
                checked={includePhotosInStory}
                onChange={(e) => setIncludePhotosInStory(e.target.checked)}
                className="mt-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <span>
                Let AI actually look at up to {MAX_IMAGES_PER_DAY_FOR_AI} photo(s) per day (not just captions).
                {' '}Uses meaningfully more API quota than caption-only — turn off if you're on a tight quota.
                {totalPhotosUploaded > 0 && includePhotosInStory && (
                  <> Currently would send up to {Math.min(totalPhotosUploaded, itinerary.length * MAX_IMAGES_PER_DAY_FOR_AI + MAX_EXTRA_IMAGES_FOR_AI)} image(s).</>
                )}
              </span>
            </label>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <label htmlFor="post-story-style" className="text-xs text-slate-400 whitespace-nowrap">Story style:</label>
              <select
                id="post-story-style"
                value={storyStyle}
                onChange={(e) => setStoryStyle(e.target.value as StoryStyle)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {STORY_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                onClick={handleGenerateStory}
                disabled={isGeneratingStory}
                className="text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold px-5 py-2.5 rounded-lg transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {isGeneratingStory ? (generatingStatus || 'Working...') : '✨ Generate My Trip Story'}
              </button>
            </div>
          </div>
          {storyError && (
            <p role="alert" className="text-xs text-rose-400 text-center">{storyError}</p>
          )}
        </div>
      )}

      {tripStory && (
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-8 max-w-2xl mx-auto shadow-md">
          <h3 className="text-2xl font-bold text-slate-100">{tripStory.title}</h3>
          <p className="text-xs text-emerald-400 uppercase font-semibold tracking-widest mt-0.5 mb-6">
            Your Trip, In Story Form
          </p>
          <p className="text-slate-300 leading-relaxed text-lg whitespace-pre-wrap italic">
            "{tripStory.content}"
          </p>
          <div className="mt-6 pt-4 border-t border-slate-800/50">
            <p className="text-xs text-slate-500 font-medium">{tripStory.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
};
