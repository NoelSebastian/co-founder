import { createFileRoute } from "@tanstack/react-router";
import { SlackPage } from "@/features/slack/SlackPage";
export const Route = createFileRoute("/slack")({ component: SlackPage });
