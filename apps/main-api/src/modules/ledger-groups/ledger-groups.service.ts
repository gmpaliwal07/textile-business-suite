import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AffectsType, GroupType, prisma, Prisma } from '@textile/database';
import { CreateLedgerGroupDto, UpdateLedgerGroupDto, LedgerGroupFiltersDto } from './dto';

@Injectable()
export class LedgerGroupsService {
    constructor(private prisma: prisma.PrismaService) { }

    /**
     * ✅ UPDATED: Create new ledger group with validations
     */
    async create(organizationId: string, dto: CreateLedgerGroupDto, userId: string) {
        // ✅ Case-insensitive duplicate check
        const existing = await this.prisma.ledgerGroup.findFirst({
            where: {
                organizationId,
                groupName: {
                    equals: dto.groupName,
                    mode: 'insensitive',
                },
                deletedAt: null,
            },
        });

        if (existing) {
            throw new BadRequestException(
                `Ledger group "${dto.groupName}" already exists. Please use a different name.`
            );
        }

        // If parent group specified, validate it exists
        if (dto.parentGroupId) {
            const parentGroup = await this.prisma.ledgerGroup.findFirst({
                where: {
                    id: dto.parentGroupId,
                    organizationId,
                    deletedAt: null,
                },
            });

            if (!parentGroup) {
                throw new NotFoundException('Parent group not found');
            }

            // ✅ Auto-calculate level based on parent
            dto.level = parentGroup.level + 1;

            // ✅ Enforce maximum depth (Tally standard: 4 levels)
            if (dto.level > 4) {
                throw new BadRequestException(
                    'Maximum group hierarchy depth is 4 levels. ' +
                    `This would be level ${dto.level}.`
                );
            }

            // ✅ Validate groupType matches parent's groupType
            if (dto.groupType !== parentGroup.groupType) {
                throw new BadRequestException(
                    `Child group type (${dto.groupType}) must match parent group type (${parentGroup.groupType})`
                );
            }

            // ✅ Validate affects matches parent's affects
            if (dto.affects !== parentGroup.affects) {
                throw new BadRequestException(
                    `Child group affects (${dto.affects}) must match parent affects (${parentGroup.affects})`
                );
            }
        } else {
            // Root level group
            dto.level = 1;
        }

        return this.prisma.ledgerGroup.create({
            data: {
                organizationId,
                groupName: dto.groupName,
                groupCode: dto.groupCode,
                groupType: dto.groupType,
                affects: dto.affects,
                parentGroupId: dto.parentGroupId,
                level: dto.level,
                description: dto.description,
                isSystemLedger: false, // ✅ User-created groups are not system groups
            },
            include: {
                parentGroup: {
                    select: {
                        groupName: true,
                        groupType: true,
                    },
                },
            },
        });
    }

    /**
     * Get all ledger groups with filters (NO CHANGES - Already correct)
     */
    async findAll(organizationId: string, filters?: LedgerGroupFiltersDto) {
        const {
            page = 1,
            limit = 50,
            search,
            groupType,
            affects,
            parentGroupId,
            isActive,
            sortBy = 'groupName',
            sortOrder = 'ASC',
        } = filters || {};

        const where: Prisma.LedgerGroupWhereInput = {
            organizationId,
            deletedAt: null,
        };

        if (search) {
            where.OR = [
                { groupName: { contains: search, mode: 'insensitive' } },
                { groupCode: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (groupType) {
            where.groupType = groupType;
        }

        if (affects) {
            where.affects = affects;
        }

        if (parentGroupId) {
            where.parentGroupId = parentGroupId;
        }

        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        const [data, total] = await Promise.all([
            this.prisma.ledgerGroup.findMany({
                where,
                include: {
                    parentGroup: {
                        select: {
                            groupName: true,
                        },
                    },
                    childGroups: {
                        where: { deletedAt: null },
                        select: {
                            id: true,
                            groupName: true,
                        },
                    },
                    ledgers: {
                        where: { deletedAt: null },
                        select: {
                            id: true,
                            ledgerName: true,
                            currentBalance: true,
                        },
                    },
                    _count: {
                        select: {
                            childGroups: true,
                            ledgers: true,
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder.toLowerCase() },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.ledgerGroup.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get ledger group by ID (NO CHANGES - Already correct)
     */
    async findById(organizationId: string, id: string) {
        const group = await this.prisma.ledgerGroup.findFirst({
            where: {
                id,
                organizationId,
                deletedAt: null,
            },
            include: {
                parentGroup: true,
                childGroups: {
                    where: { deletedAt: null },
                },
                ledgers: {
                    where: { deletedAt: null },
                    include: {
                        party: {
                            select: {
                                businessName: true,
                                partyCode: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        childGroups: true,
                        ledgers: true,
                    },
                },
            },
        });

        if (!group) {
            throw new NotFoundException('Ledger group not found');
        }

        return group;
    }

    /**
     * ✅ COMPLETELY REWRITTEN: Update ledger group with strict validations
     */
    async update(organizationId: string, id: string, dto: UpdateLedgerGroupDto) {
        const group = await this.findById(organizationId, id);

        // ✅ RULE 1: System groups cannot be modified (except name/description)
        if (group.isSystemLedger) {
            const allowedFields = ['groupName', 'description', 'isActive'];
            const attemptedChanges = Object.keys(dto).filter(
                (key) => !allowedFields.includes(key)
            );

            if (attemptedChanges.length > 0) {
                throw new BadRequestException(
                    `System groups can only update: ${allowedFields.join(', ')}. ` +
                    `Cannot change: ${attemptedChanges.join(', ')}`
                );
            }
        }

        // ✅ RULE 2: Cannot change groupType or affects if has ledgers or child groups
        const hasLedgers = (group._count?.ledgers || 0) > 0;
        const hasChildGroups = (group._count?.childGroups || 0) > 0;

        if (hasLedgers || hasChildGroups) {
            const restrictedFields = ['groupType', 'affects', 'parentGroupId'];
            const attemptedChanges = Object.keys(dto).filter((key) =>
                restrictedFields.includes(key)
            );

            if (attemptedChanges.length > 0) {
                throw new BadRequestException(
                    `Cannot change ${attemptedChanges.join(', ')} for group with ` +
                    `${group._count.ledgers} ledgers and ${group._count.childGroups} child groups. ` +
                    `Create a new group instead.`
                );
            }
        }

        // ✅ RULE 3: Name change - check for duplicates (case-insensitive)
        if (dto.groupName) {
            const existing = await this.prisma.ledgerGroup.findFirst({
                where: {
                    organizationId,
                    groupName: {
                        equals: dto.groupName,
                        mode: 'insensitive',
                    },
                    id: { not: id },
                    deletedAt: null,
                },
            });

            if (existing) {
                throw new BadRequestException(
                    `Ledger group "${dto.groupName}" already exists`
                );
            }
        }

        // ✅ RULE 4: If updating parent, validate thoroughly
        if (dto.parentGroupId) {
            const parentGroup = await this.prisma.ledgerGroup.findFirst({
                where: {
                    id: dto.parentGroupId,
                    organizationId,
                    deletedAt: null,
                },
            });

            if (!parentGroup) {
                throw new NotFoundException('Parent group not found');
            }

            // ✅ Prevent setting self as parent
            if (dto.parentGroupId === id) {
                throw new BadRequestException('Cannot set group as its own parent');
            }

            // ✅ Prevent circular reference (deep check)
            await this.validateNoCircularReference(organizationId, id, dto.parentGroupId);

            // ✅ Auto-calculate new level
            dto.level = parentGroup.level + 1;

            // ✅ Check max depth
            if (dto.level > 4) {
                throw new BadRequestException(
                    `Moving to this parent would create level ${dto.level}, ` +
                    `which exceeds maximum depth of 4`
                );
            }

            // ✅ Validate type compatibility
            if (group.groupType !== parentGroup.groupType) {
                throw new BadRequestException(
                    `Group type (${group.groupType}) must match parent type (${parentGroup.groupType})`
                );
            }

            if (group.affects !== parentGroup.affects) {
                throw new BadRequestException(
                    `Group affects (${group.affects}) must match parent affects (${parentGroup.affects})`
                );
            }
        }

        // ✅ Perform update
        return this.prisma.ledgerGroup.update({
            where: { id },
            data: {
                groupName: dto.groupName,
                groupCode: dto.groupCode,
                description: dto.description,
                parentGroupId: dto.parentGroupId,
                level: dto.level,
                isActive: dto.isActive,
            },
            include: {
                parentGroup: true,
            },
        });
    }

    /**
     * ✅ UPDATED: Delete ledger group with comprehensive checks
     */
    async remove(organizationId: string, id: string) {
        const group = await this.findById(organizationId, id);

        // ✅ RULE 1: Cannot delete system groups
        if (group.isSystemLedger) {
            throw new BadRequestException(
                'System-generated ledger groups cannot be deleted. ' +
                'These are essential for accounting operations.'
            );
        }

        // ✅ RULE 2: Cannot delete if has child groups
        const childCount = group._count?.childGroups || 0;
        if (childCount > 0) {
            const childNames = group.childGroups.map((c) => c.groupName).join(', ');
            throw new BadRequestException(
                `Cannot delete group with ${childCount} child group(s): ${childNames}. ` +
                `Delete or move child groups first.`
            );
        }

        // ✅ RULE 3: Cannot delete if has ledgers
        const ledgerCount = group._count?.ledgers || 0;
        if (ledgerCount > 0) {
            const ledgerNames = group.ledgers.slice(0, 5).map((l) => l.ledgerName).join(', ');
            throw new BadRequestException(
                `Cannot delete group with ${ledgerCount} ledger(s): ${ledgerNames}${ledgerCount > 5 ? '...' : ''}. ` +
                `Move or delete ledgers first.`
            );
        }

        // ✅ Soft delete
        await this.prisma.ledgerGroup.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                isActive: false,
            },
        });

        return {
            success: true,
            message: `Ledger group "${group.groupName}" deleted successfully`,
        };
    }

    /**
     * Get group hierarchy (NO CHANGES - Already correct)
     */
    async getHierarchy(organizationId: string) {
        // Get all root groups (level 1)
        const rootGroups = await this.prisma.ledgerGroup.findMany({
            where: {
                organizationId,
                level: 1,
                deletedAt: null,
            },
            include: {
                childGroups: {
                    where: { deletedAt: null },
                    include: {
                        childGroups: {
                            where: { deletedAt: null },
                            include: {
                                childGroups: {
                                    where: { deletedAt: null },
                                },
                                ledgers: {
                                    where: { deletedAt: null },
                                    select: {
                                        id: true,
                                        ledgerName: true,
                                        ledgerType: true,
                                        currentBalance: true,
                                    },
                                },
                            },
                        },
                        ledgers: {
                            where: { deletedAt: null },
                            select: {
                                id: true,
                                ledgerName: true,
                                ledgerType: true,
                                currentBalance: true,
                            },
                        },
                    },
                },
                ledgers: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        ledgerName: true,
                        ledgerType: true,
                        currentBalance: true,
                    },
                },
            },
            orderBy: { groupName: 'asc' },
        });

        return rootGroups;
    }

    /**
     * ✅ NEW: Validate no circular reference in hierarchy
     */
    private async validateNoCircularReference(
        organizationId: string,
        groupId: string,
        newParentId: string,
    ): Promise<void> {
        let currentParentId: string | null = newParentId;
        const visited = new Set<string>();

        // Traverse up the parent chain
        while (currentParentId) {
            // Check if we've reached the original group (circular!)
            if (currentParentId === groupId) {
                throw new BadRequestException(
                    'Cannot create circular reference in group hierarchy. ' +
                    'The new parent is a descendant of this group.'
                );
            }

            // Prevent infinite loop
            if (visited.has(currentParentId)) {
                break;
            }

            visited.add(currentParentId);

            // Get next parent
            const parent = await this.prisma.ledgerGroup.findFirst({
                where: {
                    id: currentParentId,
                    organizationId,
                    deletedAt: null,
                },
                select: {
                    parentGroupId: true,
                },
            }) as { parentGroupId: string | null } | null;

            currentParentId = parent?.parentGroupId || null;
        }
    }

    /**
     * ✅ NEW: Get groups by type (useful for dropdowns)
     */
    async findByType(organizationId: string, groupType: GroupType) {
        return this.prisma.ledgerGroup.findMany({
            where: {
                organizationId,
                groupType,
                isActive: true,
                deletedAt: null,
            },
            select: {
                id: true,
                groupName: true,
                level: true,
                parentGroupId: true,
            },
            orderBy: [
                { level: 'asc' },
                { groupName: 'asc' },
            ],
        });
    }

    /**
     * ✅ NEW: Get groups by affects (for Balance Sheet vs P&L)
     */
    async findByAffects(organizationId: string, affects: AffectsType) {
        return this.prisma.ledgerGroup.findMany({
            where: {
                organizationId,
                affects,
                isActive: true,
                deletedAt: null,
            },
            include: {
                childGroups: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        groupName: true,
                        level: true,
                    },
                },
                ledgers: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        ledgerName: true,
                        currentBalance: true,
                    },
                },
            },
            orderBy: [
                { level: 'asc' },
                { groupName: 'asc' },
            ],
        });
    }

    /**
     * ✅ NEW: Get root groups (level 1 only)
     */
    async getRootGroups(organizationId: string) {
        return this.prisma.ledgerGroup.findMany({
            where: {
                organizationId,
                level: 1,
                isActive: true,
                deletedAt: null,
            },
            include: {
                _count: {
                    select: {
                        childGroups: true,
                        ledgers: true,
                    },
                },
            },
            orderBy: {
                groupName: 'asc',
            },
        });
    }

    /**
     * ✅ NEW: Move multiple ledgers to new group (bulk operation)
     */
    async moveLedgersToGroup(
        organizationId: string,
        sourceGroupId: string,
        targetGroupId: string,
    ) {
        const [sourceGroup, targetGroup] = await Promise.all([
            this.findById(organizationId, sourceGroupId),
            this.findById(organizationId, targetGroupId),
        ]);

        // Validate compatibility
        if (sourceGroup.groupType !== targetGroup.groupType) {
            throw new BadRequestException(
                `Cannot move ledgers between different group types ` +
                `(${sourceGroup.groupType} → ${targetGroup.groupType})`
            );
        }

        // Move all ledgers
        const result = await this.prisma.ledger.updateMany({
            where: {
                organizationId,
                ledgerGroupId: sourceGroupId,
                deletedAt: null,
            },
            data: {
                ledgerGroupId: targetGroupId,
            },
        });

        return {
            success: true,
            movedCount: result.count,
            message: `Moved ${result.count} ledger(s) from "${sourceGroup.groupName}" to "${targetGroup.groupName}"`,
        };
    }

    /**
     * ✅ NEW: Get group usage statistics
     */
    async getGroupStats(organizationId: string, id: string) {
        const group = await this.findById(organizationId, id);

        // Get total balance of all ledgers under this group
        const ledgers = await this.prisma.ledger.findMany({
            where: {
                organizationId,
                ledgerGroupId: id,
                deletedAt: null,
            },
            select: {
                currentBalance: true,
            },
        });

        const totalBalance = ledgers.reduce(
            (sum, ledger) => sum + Number(ledger.currentBalance),
            0
        );

        // Get transaction count
        const entryCount = await this.prisma.voucherEntry.count({
            where: {
                ledger: {
                    ledgerGroupId: id,
                    organizationId,
                },
            },
        });

        return {
            groupName: group.groupName,
            ledgerCount: group._count.ledgers,
            childGroupCount: group._count.childGroups,
            totalBalance,
            transactionCount: entryCount,
            isSystemGroup: group.isSystemLedger,
        };
    }
}