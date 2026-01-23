import { PrismaClient } from '@prisma/client'

class PrismaService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  async connect() {
    await this.prisma.$connect()
    console.log('✅ Database connected')
  }

  async disconnect() {
    await this.prisma.$disconnect()
    console.log('❌ Database disconnected')
  }

  getClient() {
    return this.prisma
  }
}

export const prismaService = new PrismaService()
export const prisma = prismaService.getClient()
