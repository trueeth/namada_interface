import {
  Bond as IndexerBond,
  Unbond as IndexerUnbond,
  Validator as IndexerValidator,
  VotingPower as IndexerVotingPower,
} from "@anomaorg/namada-indexer-client";
import BigNumber from "bignumber.js";
import {
  AtomWithQueryResult,
  UndefinedInitialDataOptions,
  atomWithQuery,
} from "jotai-tanstack-query";
import { defaultAccountAtom } from "slices/accounts";
import { indexerApiAtom } from "./api";
import { chainParametersAtom } from "./chainParameters";
import { shouldUpdateBalanceAtom } from "./etc";

type Unique = {
  uuid: string;
};

export type Validator = Unique & {
  alias?: string;
  address: string;
  description?: string;
  homepageUrl?: string;
  expectedApr: number;
  unbondingPeriod: string;
  votingPowerInNAM?: BigNumber;
  votingPowerPercentage?: number;
  commission: BigNumber;
  imageUrl?: string;
};

export type MyValidator = {
  stakingStatus: string;
  stakedAmount?: BigNumber;
  unbondedAmount?: BigNumber;
  withdrawableAmount?: BigNumber;
  validator: Validator;
};

const toValidator = (
  indexerValidator: IndexerValidator,
  indexerVotingPower: IndexerVotingPower,
  unbondingPeriod: bigint
): Validator => {
  return {
    uuid: indexerValidator.address,
    alias: indexerValidator.name,
    description: indexerValidator.description,
    address: indexerValidator.address,
    homepageUrl: indexerValidator.website,
    // TODO: Return this from the indexer
    expectedApr: 0.1127,
    unbondingPeriod: `${unbondingPeriod} days`,
    votingPowerInNAM: BigNumber(indexerValidator.votingPower),
    votingPowerPercentage:
      Number(indexerValidator.votingPower) /
      Number(indexerVotingPower.totalVotingPower),
    commission: BigNumber(indexerValidator.commission),
    imageUrl: indexerValidator.avatar,
  };
};

export const votingPowerAtom = atomWithQuery((get) => {
  const api = get(indexerApiAtom);

  return {
    queryKey: ["voting-power"],
    queryFn: async () => {
      const response = await api.apiV1PosVotingPowerGet();
      return response.data;
    },
  };
});

export const allValidatorsAtom = atomWithQuery((get) => {
  const chainParameters = get(chainParametersAtom);
  const votingPower = get(votingPowerAtom);
  const api = get(indexerApiAtom);

  return {
    queryKey: ["all-validators"],
    enabled: chainParameters.isSuccess && votingPower.isSuccess,
    queryFn: async () => {
      const parameters =
        chainParameters.data?.unbondingPeriodInDays || BigInt(0);

      const validatorsResponse = await api.apiV1PosValidatorGet();
      // TODO: rename one data to items?
      const validators = validatorsResponse.data.data;
      const vp = votingPower.data!;

      return validators.map((v) => toValidator(v, vp, parameters));
    },
  };
});

// eslint-disable-next-line
export const myValidatorsAtom = atomWithQuery((get) => {
  const account = get(defaultAccountAtom);
  const chainParameters = get(chainParametersAtom);
  const votingPower = get(votingPowerAtom);
  const api = get(indexerApiAtom);

  // TODO: Refactor after this event subscription is enabled in the indexer
  const enablePolling = get(shouldUpdateBalanceAtom);

  return {
    queryKey: ["my-validators", account.data?.address],
    enabled:
      account.isSuccess && chainParameters.isSuccess && votingPower.isSuccess,
    refetchInterval: enablePolling ? 1000 : false,
    queryFn: async (): Promise<MyValidator[]> => {
      const unbondingPeriod = chainParameters.data!.unbondingPeriodInDays;
      const vp = votingPower.data!;

      const bondsResponse = await api.apiV1PosBondAddressGet(
        account.data!.address
      );

      return toMyValidators(bondsResponse.data.data, vp, unbondingPeriod);
    },
  };
});

export const myUnbondsAtom = atomWithQuery<MyValidator[]>((get) => {
  const chainParameters = get(chainParametersAtom);
  const account = get(defaultAccountAtom);
  const votingPower = get(votingPowerAtom);
  const api = get(indexerApiAtom);

  // TODO: Refactor after this event subscription is enabled in the indexer
  const enablePolling = get(shouldUpdateBalanceAtom);
  return {
    queryKey: ["my-unbonds", account.data?.address],
    enabled:
      account.isSuccess && chainParameters.isSuccess && votingPower.isSuccess,
    refetchInterval: enablePolling ? 1000 : false,
    queryFn: async () => {
      const unbondingPeriod = chainParameters.data!.unbondingPeriodInDays;
      const vp = votingPower.data!;
      const unbondsResponse = await api.apiV1PosUnbondAddressGet(
        account.data!.address
      );

      return toUnbondingValidators(
        unbondsResponse.data.data,
        vp,
        unbondingPeriod
      );
    },
  };
});

export const unbondedAmountByAddressAtom = atomWithQuery((get) =>
  deriveFromMyValidatorsAtom(
    "unbonded-amount",
    "unbondedAmount",
    get(myUnbondsAtom)
  )
);

export const withdrawableAmountByAddressAtom = atomWithQuery((get) =>
  deriveFromMyValidatorsAtom(
    "withdrawable-amount",
    "withdrawableAmount",
    get(myValidatorsAtom)
  )
);

export const stakedAmountByAddressAtom = atomWithQuery((get) =>
  deriveFromMyValidatorsAtom(
    "staked-amount",
    "stakedAmount",
    get(myValidatorsAtom)
  )
);

const deriveFromMyValidatorsAtom = (
  key: string,
  property: "stakedAmount" | "unbondedAmount" | "withdrawableAmount",
  myValidators: AtomWithQueryResult<MyValidator[], Error>
): UndefinedInitialDataOptions<Record<string, BigNumber>> => {
  return {
    queryKey: [key, myValidators.data],
    enabled: myValidators.isSuccess,
    queryFn: async () => {
      return myValidators.data!.reduce((prev, current) => {
        if (current[property]?.gt(0)) {
          return { ...prev, [current.validator.address]: current[property] };
        }
        return prev;
      }, {});
    },
  };
};

const toMyValidators = (
  indexerBonds: IndexerBond[],
  totalVotingPower: IndexerVotingPower,
  unbondingPeriod: bigint
): MyValidator[] => {
  return indexerBonds.map((indexerBond) => {
    const validator = toValidator(
      indexerBond.validator,
      totalVotingPower,
      unbondingPeriod
    );

    return {
      uuid: String(indexerBond.validator.validatorId),
      stakingStatus: "bonded",
      stakedAmount: BigNumber(indexerBond.amount),
      unbondedAmount: BigNumber(0),
      withdrawableAmount: BigNumber(0),
      validator,
    };
  });
};

const toUnbondingValidators = (
  indexerBonds: IndexerUnbond[],
  totalVotingPower: IndexerVotingPower,
  unbondingPeriod: bigint
): MyValidator[] => {
  return indexerBonds.map((indexerUnbond) => {
    const validator = toValidator(
      indexerUnbond.validator,
      totalVotingPower,
      unbondingPeriod
    );

    return {
      uuid: String(indexerUnbond.validator.validatorId),
      stakingStatus: "unbonded",
      stakedAmount: BigNumber(0),
      unbondedAmount: BigNumber(indexerUnbond.amount),
      withdrawableAmount: BigNumber(0),
      validator,
    };
  });
};
