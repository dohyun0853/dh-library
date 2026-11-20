import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const members = sqliteTable('members', {
 id: text('id').primaryKey(), email: text('email').notNull(), name: text('name').notNull(),
 student: text('student').notNull(), status: text('status').notNull().default('pending'), tier: integer('tier').notNull().default(1), created: text('created').notNull()
});
export const courses = sqliteTable('courses', {
 id: text('id').primaryKey(), name: text('name').notNull(), note: text('note').notNull().default(''), grade: integer('grade').notNull(), semester: integer('semester').notNull(), created: text('created').notNull()
}, t => [uniqueIndex('course_slot').on(t.grade, t.semester, t.name)]);
export const materials = sqliteTable('materials', {
 id: text('id').primaryKey(), course: text('course').notNull().references(()=>courses.id), title: text('title').notNull(), tier: integer('tier').notNull().default(1), folder: text('folder').notNull().default('other'), exam: text('exam').notNull(), kind: text('kind').notNull(), filename: text('filename').notNull(), mime: text('mime').notNull(), size: integer('size').notNull(), created: text('created').notNull()
});
export const messages = sqliteTable('messages', {
 id: text('id').primaryKey(), thread: text('thread').notNull().references(()=>members.id), sender: text('sender').notNull(), body: text('body').notNull(), created: text('created').notNull()
});
export const messageAttachments=sqliteTable('message_attachments',{
 id:text('id').primaryKey(), message:text('message').notNull().references(()=>messages.id), filename:text('filename').notNull(), mime:text('mime').notNull(), size:integer('size').notNull(), created:text('created').notNull()
});

export const folders = sqliteTable('folders', {
 id: text('id').primaryKey(), course: text('course').notNull().references(()=>courses.id), name: text('name').notNull(), parent: text('parent').notNull().default(''), created: text('created').notNull()
}, t => [uniqueIndex('folder_sibling').on(t.course,t.parent,t.name)]);

export const pushSubscriptions=sqliteTable('push_subscriptions',{
 id:text('id').primaryKey(), user:text('user').notNull(), email:text('email').notNull(), role:text('role').notNull(), subscription:text('subscription').notNull(), created:text('created').notNull(), updated:text('updated').notNull()
});
