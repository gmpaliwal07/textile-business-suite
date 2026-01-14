import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService {
    private supabase: SupabaseClient | null = null;
    private isCloudMode: boolean;

    constructor(private configService: ConfigService) {
        // Check if running in cloud mode
        this.isCloudMode = !!this.configService.get('SUPABASE_URL');

        if (this.isCloudMode) {
            this.supabase = createClient(
                this.configService.get('SUPABASE_URL') as string,
                this.configService.get('SUPABASE_SERVICE_KEY') as string,
            );
        }
    }

    /**
     * Upload file (works for both local and cloud)
     */
    async uploadFile(
        bucket: string,
        fileName: string,
        fileBuffer: Buffer,
        contentType: string,
    ): Promise<string> {
        if (this.isCloudMode) {
            // Cloud: Upload to Supabase
            const { error } = await this.supabase!.storage
                .from(bucket)
                .upload(fileName, fileBuffer, {
                    contentType,
                    upsert: false,
                });

            if (error) throw error;

            return this.supabase!.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
        } else {
            // Local: Save to file system
            const localPath = path.join(process.cwd(), 'uploads', bucket, fileName);
            await fs.mkdir(path.dirname(localPath), { recursive: true });
            await fs.writeFile(localPath, fileBuffer);
            return `/uploads/${bucket}/${fileName}`;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(bucket: string, fileName: string): Promise<void> {
        if (this.isCloudMode) {
            const { error } = await this.supabase!.storage.from(bucket).remove([fileName]);
            if (error) throw error;
        } else {
            const localPath = path.join(process.cwd(), 'uploads', bucket, fileName);
            await fs.unlink(localPath);
        }
    }

    /**
     * Get file URL
     */
    getFileUrl(bucket: string, fileName: string): string {
        if (this.isCloudMode) {
            return this.supabase!.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
        } else {
            return `/uploads/${bucket}/${fileName}`;
        }
    }
}