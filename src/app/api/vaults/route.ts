import { NextRequest, NextResponse } from 'next/server';
import { createVault, listVaults } from '@/lib/case-api';

export async function GET() {
  try {
    const result = await listVaults();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to list vaults:', error);
    return NextResponse.json(
      { error: 'Failed to list vaults' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Vault name is required' },
        { status: 400 }
      );
    }

    const vault = await createVault(name, description);
    return NextResponse.json(vault);
  } catch (error) {
    console.error('Failed to create vault:', error);
    return NextResponse.json(
      { error: 'Failed to create vault' },
      { status: 500 }
    );
  }
}
