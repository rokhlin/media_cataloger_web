export type MediaType = 'image' | 'video' | string;
export type MediaProcessingStatus = 'PROCESSED' | 'UNPROCESSED' | 'PENDING' | string;

export interface TimelineEventItem {
  timestamp_start?: string;
  timestamp_end?: string;
  activity?: string;
  activity_ru?: string;
}

export interface FamilyMemberContext {
  name: string;
  kinshipToRoot?: string;
  category?: string;
}

export interface FamilyRelationshipContext {
  person1: string;
  person2: string;
  relationship: string;
}

export interface FamilyMilestoneContext {
  personName: string;
  type: string;
  title: string;
  date?: string;
  location?: string;
}

export interface FamilyContextData {
  suggested_caption?: string;
  identified_members?: FamilyMemberContext[];
  relationships?: FamilyRelationshipContext[];
  milestones?: FamilyMilestoneContext[];
}

export interface MediaFileItem {
  filename: string;
  file_path?: string;
  relative_path?: string;
  absolute_path?: string;
  type?: MediaType;
  is_image?: boolean;
  is_video?: boolean;
  file_size?: number;
  mtime?: number;
  status?: MediaProcessingStatus;
  face_count?: number;
  face_names?: string[];
  capture_date?: string;
  size_bytes?: number;
  has_sidecar?: boolean;
  thumbnail_url?: string;
  duration?: number;
  resolution?: string;
  description?: string;
  description_ru?: string;
  summary?: string;
  summary_ru?: string;
  environment?: 'indoor' | 'outdoor' | 'unknown' | string;
  lighting?: string;
  lighting_ru?: string;
  weather?: string;
  weather_ru?: string;
  time_of_day?: string;
  time_of_day_ru?: string;
  ocr_text?: string;
  exif_analysis?: string;
  exif_analysis_ru?: string;
  transcription?: string;
  transcription_ru?: string;
  timeline_events?: TimelineEventItem[];
  folder?: string;
  sidecar_path?: string;
  sidecar?: Record<string, unknown> | null;
  family_context?: FamilyContextData;
}

export interface GalleryMediaFile extends MediaFileItem {
  faces?: Array<{
    face_id?: string;
    person_id?: string;
    name?: string;
    image_path?: string;
    confidence?: number;
    is_reference?: boolean | number;
  }>;
  has_unassigned_faces?: boolean;
}
