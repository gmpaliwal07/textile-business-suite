import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { CancelEwbDto, GenerateEwbDto, UpdateVehicleDto } from '../dto';

@Injectable()
export class EWayBillService {
    private readonly logger = new Logger(EWayBillService.name);

    private baseUrl: string;
    private appKey: string;
    private username: string;
    private password: string;
    private nodeEnv: string;
    private isMock: boolean;

    // For mock server token caching
    private mockBearerToken: string | null = null;
    private mockTokenExpiry: number = 0;

    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
    ) {
        this.nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
        this.isMock = this.nodeEnv === 'development' || this.nodeEnv === 'test';

        if (this.isMock) {
            this.baseUrl = this.configService.get<string>('NIC_MOCK_URL') || 'http://localhost:3002';
            this.appKey = this.configService.get<string>('MOCK_APP_KEY') || 'mock-app-key';
            this.username = this.configService.get<string>('MOCK_USERNAME') || 'admin';
            this.password = this.configService.get<string>('MOCK_PASSWORD') || 'admin';
        } else {
            this.baseUrl = 'https://ewaybillgst.gov.in/ewbapi/v1.03';
            this.appKey = this.configService.get<string>('APP_KEY') || '';
            this.username = this.configService.get<string>('NIC_USERNAME') || '';
            this.password = this.configService.get<string>('NIC_PASSWORD') || '';

            if (!this.username || !this.password || !this.appKey) {
                throw new Error('Missing NIC credentials for production');
            }
        }
    }

    // Get Bearer token for mock server (cached for 12 hours)
    private async getMockBearerToken(): Promise<string> {
        const now = Date.now();

        if (this.mockBearerToken && now < this.mockTokenExpiry) {
            return this.mockBearerToken;
        }

        try {
            this.logger.log('Fetching new auth token from NIC mock server...');

            const loginResponse = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/auth/login`, {
                    username: this.username,
                    password: this.password,
                    app_key: this.appKey,
                }),
            );

            if (!loginResponse.data.token) {
                throw new Error('No token received from mock server');
            }

            this.mockBearerToken = loginResponse.data.token;
            // Mock tokens expire in 12 hours
            this.mockTokenExpiry = now + 12 * 60 * 60 * 1000;

            this.logger.log('Successfully obtained mock auth token');
            return this.mockBearerToken as string;
        } catch (error) {
            this.logger.error('Failed to login to NIC mock server', error);
            throw new HttpException(
                'Unable to authenticate with E-Way Bill mock service',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // Get official authtoken from real NIC (production only)
    private async getRealAuthToken(): Promise<string> {
        const authPayload = {
            action: 'ACCESSTOKEN',
            username: this.username,
            password: this.password,
            app_key: this.appKey,
        };

        try {
            const response = await firstValueFrom(
                this.httpService.post<{ status: string; authtoken: string; sek: string }>(
                    `${this.baseUrl}/auth`,
                    authPayload,
                ),
            );

            if (response.data.status === '1') {
                return response.data.authtoken;
            }
            throw new Error('NIC auth failed: Invalid response');
        } catch (error) {
            this.logger.error('NIC real authentication failed', error);
            throw new HttpException('NIC Authentication failed', HttpStatus.UNAUTHORIZED);
        }
    }

    // Unified header generator
    private async getHeaders() {
        if (this.isMock) {
            const token = await this.getMockBearerToken();
            return {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            };
        } else {
            const authtoken = await this.getRealAuthToken();
            return {
                authtoken,
                'Content-Type': 'application/json',
            };
        }
    }

    async generateEwb(dto: GenerateEwbDto, user: any) {
        const headers = await this.getHeaders();
        const endpoint = this.isMock ? '/ewaybill/generate' : '/ewaybill';

        const payload = this.isMock ? dto : { /* Add real NIC encrypted payload here when ready */ };

        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}${endpoint}`, payload, { headers }),
            );
            return response.data;
        } catch (error) {
            this.handleAxiosError(error, 'E-Way Bill generation failed');
            throw error; // re-throw so controller gets proper error
        }
    }

    async getEwb(ewbNo: string) {
        const headers = await this.getHeaders();
        const endpoint = this.isMock ? `/ewaybill/${ewbNo}` : `/ewaybill?ewbNo=${ewbNo}`;

        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}${endpoint}`, { headers }),
            );
            return response.data;
        } catch (error) {
            this.handleAxiosError(error, 'Failed to fetch E-Way Bill');
            throw new HttpException('Failed to fetch E-Way Bill', HttpStatus.NOT_FOUND);
        }
    }

    async cancelEwb(dto: CancelEwbDto, user: any) {
        const headers = await this.getHeaders();
        const endpoint = this.isMock ? '/ewaybill/cancel' : '/ewaybill/cancel';

        const payload = this.isMock ? dto : { /* Real NIC cancel payload */ };

        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}${endpoint}`, payload, { headers }),
            );
            return response.data;
        } catch (error) {
            this.handleAxiosError(error, 'Cancellation failed');
            throw error;
        }
    }

    async updateVehicle(dto: UpdateVehicleDto) {
        const headers = await this.getHeaders();
        const endpoint = this.isMock ? '/ewaybill/update-vehicle' : '/ewaybill/updatePartB';

        const payload = this.isMock ? dto : { /* Real NIC update payload */ };

        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrl}${endpoint}`, payload, { headers }),
            );
            return response.data;
        } catch (error) {
            this.handleAxiosError(error, 'Vehicle update failed');
            throw new HttpException('Vehicle update failed', HttpStatus.BAD_REQUEST);
        }
    }

    // Helper to centralize error logging
    private handleAxiosError(error: any, context: string) {
        if (error instanceof AxiosError) {
            this.logger.error(`${context}:`, error.response?.data || error.message);
        } else {
            this.logger.error(`${context}:`, error);
        }
    }
}