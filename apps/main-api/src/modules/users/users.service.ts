import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from '@textile/database';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
    constructor(private prisma: prisma.PrismaService) { }

    async create(dto: CreateUserDto & { organizationId: string }) {
        try {
            let passwordHash: string | undefined;
            if (dto.password) {
                passwordHash = await bcrypt.hash(dto.password, 10);
            }

            const { password: _password, ...createData } = dto;

            const newUser = await this.prisma.user.create({
                data: {
                    ...createData,
                    phone: dto.phone!,
                    passwordHash,
                    phoneVerified: true,
                    emailVerified: !!dto.email,
                },
                include: { organization: true },
            });

            return newUser;
        } catch (error: any) {
            if (error.code === 'P2002') {
                const target = error.meta?.target as string[];
                const field = target?.[0] || 'field';
                throw new ConflictException(`User with this ${field} already exists`);
            }

            throw error;
        }
    }

    async findById(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { organization: true },
        });

        if (!user || !user.isActive || user.deletedAt !== null) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async findByPhoneOrEmail(identifier: string) {
        return this.prisma.user.findFirst({
            where: {
                OR: [
                    { phone: identifier },
                    { email: identifier }
                ],
                isActive: true,
                deletedAt: null,
            },
            include: { organization: true },
        });
    }

    async findByOrg(orgId: string) {
        return this.prisma.user.findMany({
            where: {
                organizationId: orgId,
                isActive: true,
                deletedAt: null
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async update(id: string, dto: UpdateUserDto) {
        try {

            const updatedUser = await this.prisma.user.update({
                where: { id },
                data: dto,
                include: { organization: true },
            });

            if (!updatedUser.isActive || updatedUser.deletedAt !== null) {
                throw new NotFoundException('User not found');
            }

            return updatedUser;
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new NotFoundException('User not found');
            }
            // Duplicate key error
            if (error.code === 'P2002') {
                const target = error.meta?.target as string[];
                const field = target?.[0] || 'field';
                throw new ConflictException(`User with this ${field} already exists`);
            }

            throw error;
        }
    }

    async remove(id: string) {
        try {
            await this.prisma.user.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    isActive: false,
                }
            });

            return { success: true, message: 'User deleted successfully' };
        } catch (error: any) {

            if (error.code === 'P2025') {
                throw new NotFoundException('User not found');
            }

            throw error;
        }
    }

    async updateLastLoginAt(id: string, ip: string) {
        try {
            return await this.prisma.user.update({
                where: { id },
                data: {
                    lastLoginAt: new Date(),
                    lastLoginIp: ip
                },
            });
        } catch (error: any) {
            if (error.code === 'P2025') {
                console.warn(`Attempted to update last login for non-existent user: ${id}`);
                return null;
            }

            throw error;
        }
    }
}