import {
  Proposal,
  ProposalStatus,
  ProposalTypeString,
  VoteType,
} from "@namada/types";
import { useAtomValue } from "jotai";
import { atomWithMutation, atomWithQuery } from "jotai-tanstack-query";
import { atomFamily } from "jotai/utils";
import { defaultAccountAtom } from "slices/accounts";
import { chainAtom } from "slices/chain";
import {
  fetchAllProposals,
  fetchProposalById,
  fetchProposalVoted,
  fetchVotedProposalIds,
  performVote,
} from "./functions";

import { indexerApiAtom } from "slices/api";
import { queryClient } from "store";

export const proposalFamily = atomFamily((id: bigint) =>
  atomWithQuery((get) => {
    const api = get(indexerApiAtom);

    return {
      queryKey: ["proposal", id.toString()],
      queryFn: () => fetchProposalById(api, id),
    };
  })
);

export type StoredProposal = Pick<
  Proposal,
  | "id"
  | "author"
  | "content"
  | "startEpoch"
  | "endEpoch"
  | "activationEpoch"
  | "startTime"
  | "endTime"
  | "proposalType"
  | "tallyType"
> &
  (
    | { status?: undefined }
    | Pick<Proposal, "status" | "yay" | "nay" | "abstain" | "totalVotingPower">
  );

export const proposalFamilyPersist = atomFamily((id: bigint) =>
  atomWithQuery<StoredProposal>(
    (get) => {
      const proposal = get(proposalFamily(id));

      return {
        enabled: proposal.isSuccess,
        queryKey: ["proposal-persist", id.toString()],
        queryFn: async () => {
          const {
            id,
            author,
            content,
            startEpoch,
            endEpoch,
            activationEpoch,
            startTime,
            endTime,
            proposalType,
            tallyType,
            status,
            yay,
            nay,
            abstain,
            totalVotingPower,
          } = proposal.data!;

          // If proposal is finished, it is safe to store status and voting data
          const finishedProposalProps =
            status === "passed" || status === "rejected" ?
              { status, yay, nay, abstain, totalVotingPower }
            : {};

          return {
            id,
            author,
            content,
            startEpoch,
            endEpoch,
            activationEpoch,
            startTime,
            endTime,
            proposalType,
            tallyType,
            ...finishedProposalProps,
          };
        },
        meta: { persist: true },
      };
    },
    // TODO: It should be possible to avoid passing queryClient manually
    () => queryClient
  )
);

export const proposalVotedFamily = atomFamily((id: bigint) => {
  const account = useAtomValue(defaultAccountAtom);
  return atomWithQuery((get) => {
    const api = get(indexerApiAtom);
    return {
      queryKey: ["proposal-voted", id.toString()],
      enabled: account.isSuccess,
      queryFn: async () => {
        if (typeof account.data === "undefined") {
          throw new Error("no account found");
        }
        return await fetchProposalVoted(api, id, account.data);
      },
    };
  });
});

export const allProposalsAtom = atomWithQuery((get) => {
  const api = get(indexerApiAtom);
  return {
    queryKey: ["all-proposals"],
    queryFn: () => fetchAllProposals(api),
  };
});

// TODO: this is a bad way to filter/search
export const allProposalsFamily = atomFamily(
  (options?: {
    status?: ProposalStatus;
    type?: ProposalTypeString;
    search?: string;
  }) =>
    atomWithQuery((get) => {
      const api = get(indexerApiAtom);

      return {
        queryKey: [
          "all-proposals",
          options?.status,
          options?.type,
          options?.search,
        ],
        queryFn: () => fetchAllProposals(api),
      };
    }),
  (a, b) =>
    a?.status === b?.status && a?.type === b?.type && a?.search === b?.search
);

export const votedProposalIdsAtom = atomWithQuery((get) => {
  const account = get(defaultAccountAtom);
  const api = get(indexerApiAtom);

  return {
    queryKey: ["voted-proposal-ids"],
    enabled: account.isSuccess,
    queryFn: async () => {
      if (typeof account.data === "undefined") {
        throw new Error("no account found");
      }
      return await fetchVotedProposalIds(api, account.data);
    },
  };
});

type PerformVoteArgs = {
  proposalId: bigint;
  vote: VoteType;
};
export const performVoteAtom = atomWithMutation((get) => {
  const account = get(defaultAccountAtom);
  const api = get(indexerApiAtom);

  return {
    enabled: account.isSuccess,
    mutationKey: ["voting"],
    mutationFn: async ({ proposalId, vote }: PerformVoteArgs) => {
      const chain = get(chainAtom);
      if (typeof account.data === "undefined") {
        throw new Error("no account");
      }
      performVote(api, proposalId, vote, account.data, chain);
    },
  };
});
