import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { eq, inArray } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { activities, db, follows, tastingNotes, tastingNoteTags, userShelf, users } from '@/lib/db'
import { captureBusinessEvent } from '@/lib/sentry-business'

export const runtime = 'nodejs'

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [headers.join(',')]
  rows.forEach((row) => {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','))
  })
  return lines.join('\n')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      pseudo: users.pseudo,
      visibility: users.visibility,
      shelfVisibility: users.shelfVisibility,
      town: users.town,
      countryId: users.countryId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userRows[0]) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const notes = await db
    .select({
      id: tastingNotes.id,
      whiskyId: tastingNotes.whiskyId,
      status: tastingNotes.status,
      tastingDate: tastingNotes.tastingDate,
      location: tastingNotes.location,
      locationVisibility: tastingNotes.locationVisibility,
      latitude: tastingNotes.latitude,
      longitude: tastingNotes.longitude,
      country: tastingNotes.country,
      city: tastingNotes.city,
      overall: tastingNotes.overall,
      rating: tastingNotes.rating,
      createdAt: tastingNotes.createdAt,
      updatedAt: tastingNotes.updatedAt,
    })
    .from(tastingNotes)
    .where(eq(tastingNotes.userId, userId))

  type NoteRow = {
    id: string
    whiskyId: string
    status: string
    tastingDate: string
    location: string | null
    locationVisibility: string
    latitude: number | null
    longitude: number | null
    country: string | null
    city: string | null
    overall: string | null
    rating: number | null
    createdAt: Date | string | number | null
    updatedAt: Date | string | number | null
  }

  const noteIds = (notes as NoteRow[]).map((n: NoteRow) => n.id)
  const noteTags = noteIds.length
    ? await db
        .select({
          noteId: tastingNoteTags.noteId,
          tagId: tastingNoteTags.tagId,
          type: tastingNoteTags.type,
        })
        .from(tastingNoteTags)
        .where(inArray(tastingNoteTags.noteId, noteIds))
    : []

  const shelf = await db
    .select({
      whiskyId: userShelf.whiskyId,
      status: userShelf.status,
      createdAt: userShelf.createdAt,
      updatedAt: userShelf.updatedAt,
    })
    .from(userShelf)
    .where(eq(userShelf.userId, userId))

  const following = await db
    .select({ followedId: follows.followedId, createdAt: follows.createdAt })
    .from(follows)
    .where(eq(follows.followerId, userId))

  const followers = await db
    .select({ followerId: follows.followerId, createdAt: follows.createdAt })
    .from(follows)
    .where(eq(follows.followedId, userId))

  const myActivities = await db
    .select({
      id: activities.id,
      type: activities.type,
      targetId: activities.targetId,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .where(eq(activities.userId, userId))

  const accountCsv = toCsv(
    ['id', 'email', 'pseudo', 'visibility', 'shelf_visibility', 'town', 'country_id', 'created_at', 'updated_at'],
    [
      {
        id: userRows[0].id,
        email: userRows[0].email,
        pseudo: userRows[0].pseudo,
        visibility: userRows[0].visibility,
        shelf_visibility: userRows[0].shelfVisibility,
        town: userRows[0].town,
        country_id: userRows[0].countryId,
        created_at: userRows[0].createdAt,
        updated_at: userRows[0].updatedAt,
      },
    ]
  )

  const notesCsv = toCsv(
    [
      'id',
      'whisky_id',
      'status',
      'tasting_date',
      'location',
      'location_visibility',
      'latitude',
      'longitude',
      'country',
      'city',
      'overall',
      'rating',
      'created_at',
      'updated_at',
    ],
    (notes as NoteRow[]).map((note: NoteRow) => ({
      id: note.id,
      whisky_id: note.whiskyId,
      status: note.status,
      tasting_date: note.tastingDate,
      location: note.location,
      location_visibility: note.locationVisibility,
      latitude: note.latitude,
      longitude: note.longitude,
      country: note.country,
      city: note.city,
      overall: note.overall,
      rating: note.rating,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
    }))
  )

  const noteTagsCsv = toCsv(
    ['note_id', 'tag_id', 'type'],
    (noteTags as { noteId: string; tagId: string; type: string }[]).map((tag: { noteId: string; tagId: string; type: string }) => ({ note_id: tag.noteId, tag_id: tag.tagId, type: tag.type }))
  )

  const shelfCsv = toCsv(
    ['whisky_id', 'status', 'created_at', 'updated_at'],
    (shelf as { whiskyId: string; status: string; createdAt: Date | string | number | null; updatedAt: Date | string | number | null }[]).map((item: { whiskyId: string; status: string; createdAt: Date | string | number | null; updatedAt: Date | string | number | null }) => ({
      whisky_id: item.whiskyId,
      status: item.status,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))
  )

  const followsCsv = toCsv(
    ['kind', 'user_id', 'created_at'],
    [
      ...(following as { followedId: string; createdAt: Date | string | number | null }[]).map((row: { followedId: string; createdAt: Date | string | number | null }) => ({ kind: 'following', user_id: row.followedId, created_at: row.createdAt })),
      ...(followers as { followerId: string; createdAt: Date | string | number | null }[]).map((row: { followerId: string; createdAt: Date | string | number | null }) => ({ kind: 'follower', user_id: row.followerId, created_at: row.createdAt })),
    ]
  )

  const activitiesCsv = toCsv(
    ['id', 'type', 'target_id', 'created_at'],
    (myActivities as { id: string; type: string; targetId: string; createdAt: Date | string | number | null }[]).map((row: { id: string; type: string; targetId: string; createdAt: Date | string | number | null }) => ({ id: row.id, type: row.type, target_id: row.targetId, created_at: row.createdAt }))
  )

  await captureBusinessEvent('account_data_exported', {
    level: 'info',
    tags: { userId },
    extra: {
      notesCount: notes.length,
      shelfCount: shelf.length,
      followsCount: following.length + followers.length,
      activitiesCount: myActivities.length,
    },
  })

  return NextResponse.json({
    files: [
      { name: 'account.csv', content: accountCsv },
      { name: 'tasting_notes.csv', content: notesCsv },
      { name: 'tasting_note_tags.csv', content: noteTagsCsv },
      { name: 'shelf.csv', content: shelfCsv },
      { name: 'follows.csv', content: followsCsv },
      { name: 'activities.csv', content: activitiesCsv },
    ],
  })
}
