/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  siteName?: string
  siteUrl?: string
  recipientName?: string
  title?: string
  message?: string
  actionUrl?: string
  actionLabel?: string
  senderName?: string
}

const SITE_NAME_DEFAULT = 'aothrerp'
const SITE_URL_DEFAULT = 'https://erp.aothr.com'

const Email = ({
  siteName = SITE_NAME_DEFAULT,
  siteUrl = SITE_URL_DEFAULT,
  recipientName,
  title = 'You have a new notification',
  message,
  actionUrl,
  actionLabel = 'Open in ERP',
  senderName,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{siteName}</Text>
        </Section>
        <Heading style={h1}>{title}</Heading>
        {recipientName && <Text style={text}>Hi {recipientName},</Text>}
        {senderName && (
          <Text style={text}>
            <strong>{senderName}</strong> sent you a message:
          </Text>
        )}
        {message && (
          <Section style={quoteBox}>
            <Text style={quoteText}>{message}</Text>
          </Section>
        )}
        {actionUrl && (
          <Section style={{ textAlign: 'center', marginTop: '28px' }}>
            <Button href={actionUrl} style={button}>
              {actionLabel}
            </Button>
          </Section>
        )}
        <Text style={footer}>
          You received this because you have an account on {siteName}. Manage
          your notifications inside the app at{' '}
          <a href={siteUrl} style={link}>
            {siteUrl.replace(/^https?:\/\//, '')}
          </a>
          .
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Props) => data?.title || 'New notification from aothrerp',
  displayName: 'In-app Notification',
  previewData: {
    siteName: SITE_NAME_DEFAULT,
    siteUrl: SITE_URL_DEFAULT,
    recipientName: 'Jane',
    title: 'Requisition REQ-000123 approved',
    message: 'Your requisition has been approved and is ready to proceed.',
    actionUrl: SITE_URL_DEFAULT + '/notifications',
    actionLabel: 'View in ERP',
    senderName: 'John Doe',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
}
const header = { borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }
const brand = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#1e40af',
  margin: 0,
  letterSpacing: '0.02em',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 600,
  color: '#0f172a',
  margin: '28px 0 12px',
}
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '10px 0' }
const quoteBox = {
  backgroundColor: '#f1f5f9',
  borderLeft: '3px solid #1e40af',
  padding: '14px 18px',
  borderRadius: '4px',
  margin: '16px 0',
}
const quoteText = { fontSize: '15px', color: '#0f172a', margin: 0, lineHeight: '1.6' }
const button = {
  backgroundColor: '#1e40af',
  color: '#ffffff',
  padding: '12px 22px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: '#64748b',
  marginTop: '36px',
  borderTop: '1px solid #e5e7eb',
  paddingTop: '16px',
  lineHeight: '1.5',
}
const link = { color: '#1e40af', textDecoration: 'none' }
