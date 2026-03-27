import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";

export interface SupportRequestEmailProps {
  email: string;
  message: string;
  name: string;
  origin: string;
  subjectLine: string;
  submittedAtIso: string;
}

export default function SupportRequestEmail({
  name,
  email,
  subjectLine,
  message,
  submittedAtIso,
  origin,
}: SupportRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New support request from {name}</Preview>
      <Tailwind>
        <Body className="mx-auto bg-zinc-100 font-sans text-zinc-900">
          <Container className="mx-auto max-w-[560px] px-4 py-8">
            <Heading className="m-0 font-semibold text-xl text-zinc-900 leading-8">
              Support request
            </Heading>
            <Text className="mt-2 text-sm text-zinc-600">SmartReply</Text>
            <Hr className="my-6 border-zinc-200" />
            <Section>
              <Text className="m-0 text-sm text-zinc-800">
                <strong>From:</strong> {name}
              </Text>
              <Text className="m-0 mt-1 text-sm text-zinc-800">
                <strong>Email:</strong>{" "}
                <Link className="text-sky-600" href={`mailto:${email}`}>
                  {email}
                </Link>
              </Text>
              <Text className="m-0 mt-1 text-sm text-zinc-800">
                <strong>Subject:</strong> {subjectLine}
              </Text>
              <Text className="m-0 mt-4 text-sm text-zinc-800">
                <strong>Message</strong>
              </Text>
              <Text className="mt-2 whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-800 leading-6">
                {message}
              </Text>
              <Text className="mt-6 text-xs text-zinc-500">
                Submitted {submittedAtIso} · {origin}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
