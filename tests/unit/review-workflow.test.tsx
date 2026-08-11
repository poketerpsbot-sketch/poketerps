// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewHistory } from "@/components/admin/review-history";
import { NotificationList } from "@/components/profiles/notification-list";
import { reviewNotificationFor, reviewPresentation } from "@/lib/reviews/presentation";
import { moderateReviewSchema, resubmitReviewSchema } from "@/lib/validation/community";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/components/forms/form-api", () => ({ submitJson: vi.fn() }));

import { AdminModerationActions } from "@/components/admin/admin-actions";

describe("review moderation validation", () => {
  it.each(["REJECTED", "CHANGES_REQUESTED"] as const)(
    "requires a non-empty message for %s",
    (status) => {
      expect(moderateReviewSchema.safeParse({ status }).success).toBe(false);
      expect(moderateReviewSchema.safeParse({ status, reason: "   " }).success).toBe(false);
      expect(
        moderateReviewSchema.safeParse({ status, reason: "Merci de préciser ton expérience." })
          .success,
      ).toBe(true);
    },
  );

  it("keeps approval available without an artificial reason", () => {
    expect(moderateReviewSchema.safeParse({ status: "APPROVED" }).success).toBe(true);
  });

  it("validates a complete corrected version before resubmission", () => {
    const valid = {
      content: "Version corrigée et suffisamment détaillée.",
      overallRating: 8.5,
      ratings: [{ criterionId: "550e8400-e29b-41d4-a716-446655440000", score: 8 }],
    };
    expect(resubmitReviewSchema.safeParse(valid).success).toBe(true);
    expect(resubmitReviewSchema.safeParse({ ...valid, content: "Court" }).success).toBe(false);
    expect(
      resubmitReviewSchema.safeParse({ ...valid, ratings: [valid.ratings[0], valid.ratings[0]] })
        .success,
    ).toBe(false);
  });
});

describe("review status messaging", () => {
  it("uses the requested personal status descriptions", () => {
    expect(reviewPresentation("PENDING_REVIEW")).toMatchObject({
      label: "EN ATTENTE",
      description: "Ton avis est en cours de vérification.",
    });
    expect(reviewPresentation("CHANGES_REQUESTED").label).toBe("MODIFICATION DEMANDÉE");
    expect(reviewPresentation("REJECTED").description).toBe("Cet avis n’a pas été accepté.");
    expect(reviewPresentation("PUBLISHED").description).toBe("Cet avis est public.");
  });

  it("builds explicit internal and Telegram notification copy", () => {
    expect(reviewNotificationFor("PUBLISHED", "Blue Zushi").message).toBe(
      "✅ Ton avis a été approuvé et est maintenant publié.",
    );
    expect(reviewNotificationFor("REJECTED", "Blue Zushi", "Trop court").message).toContain(
      "Motif :\nTrop court",
    );
    expect(
      reviewNotificationFor("CHANGES_REQUESTED", "Blue Zushi", "Précise l’arôme").message,
    ).toContain("Message de l’équipe :\nPrécise l’arôme");
  });
});

describe("review moderation mobile dialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens a mandatory reason dialog for a rejection", () => {
    render(
      <AdminModerationActions
        endpoint="/api/admin/reviews/550e8400-e29b-41d4-a716-446655440000"
        reasonRequired
        actions={[{ status: "REJECTED", label: "Refuser", tone: "danger" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /refuser/i }));
    expect(screen.getByRole("dialog").textContent).toContain("Pourquoi refuses-tu cet avis ?");
    expect((screen.getByLabelText("Motif du refus") as HTMLTextAreaElement).required).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Confirmer le refus" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("opens the team-message dialog for requested changes", () => {
    render(
      <AdminModerationActions
        endpoint="/api/admin/reviews/550e8400-e29b-41d4-a716-446655440000"
        reasonRequired
        actions={[{ status: "CHANGES_REQUESTED", label: "Demander une modification" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /demander une modification/i }));
    expect(screen.getByRole("dialog").textContent).toContain(
      "Explique à l’utilisateur ce qu’il doit modifier",
    );
    expect(
      (screen.getByLabelText("Message pour l’utilisateur") as HTMLTextAreaElement).required,
    ).toBe(true);
  });
});

describe("review history and notifications UI", () => {
  it("shows actors, reasons and a closed change request", () => {
    const html = renderToStaticMarkup(
      <ReviewHistory
        events={[
          {
            id: "event-1",
            action: "CHANGES_REQUESTED",
            message: "Précise l’arôme.",
            admin: { displayName: "Alice", username: "alice" },
            createdAt: "2026-08-10T10:00:00.000Z",
            resolvedAt: "2026-08-10T11:00:00.000Z",
          },
        ]}
      />,
    );
    expect(html).toContain("Modification demandée");
    expect(html).toContain("@alice");
    expect(html).toContain("Précise l’arôme.");
    expect(html).toContain("demande clôturée");
  });

  it("classifies review notifications and links to the correction", () => {
    const html = renderToStaticMarkup(
      <NotificationList
        initialItems={[
          {
            id: "notification-1",
            type: "REVIEW_CHANGES_REQUESTED",
            title: "Modification demandée sur ton avis",
            message: "Précise l’arôme.",
            actionUrl: "/profil/avis/review-1",
            isRead: false,
            createdAt: "2026-08-10T10:00:00.000Z",
          },
        ]}
      />,
    );
    expect(html).toContain("AVIS");
    expect(html).toContain("Modifier mon avis");
    expect(html).toContain('href="/profil/avis/review-1"');
    expect(html).toContain("1 notification non lue");
  });
});
