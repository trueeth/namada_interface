import { ActionButton, Panel } from "@namada/components";
import { NamCurrency } from "App/Common/NamCurrency";
import { TableRowLoading } from "App/Common/TableRowLoading";
import BigNumber from "bignumber.js";
import clsx from "clsx";
import invariant from "invariant";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { MyValidator, Validator, myValidatorsAtom } from "slices/validators";
import { twMerge } from "tailwind-merge";
import { ReDelegateTable } from "./ReDelegateTable";

type ReDelegateRemoveStakeProps = {
  onChangeValidatorAmount: (
    validator: Validator,
    amount: BigNumber | undefined
  ) => void;
  amountsRemovedByAddress: Record<string, BigNumber>;
  stakedAmountByAddress: Record<string, BigNumber>;
  onProceed: () => void;
};

export const ReDelegateRemoveStake = ({
  onChangeValidatorAmount,
  amountsRemovedByAddress,
  stakedAmountByAddress,
  onProceed,
}: ReDelegateRemoveStakeProps): JSX.Element => {
  const myValidators = useAtomValue(myValidatorsAtom);

  const validators = useMemo(() => {
    if (!myValidators.isSuccess) return [];
    return myValidators.data.map((mv: MyValidator) => mv.validator);
  }, [myValidators.data]);

  const renderInfoColumn = (validator: Validator): JSX.Element => {
    const stakedAmount = stakedAmountByAddress[validator.address] ?? 0;
    const updatedAmounts = amountsRemovedByAddress[validator.address];
    const hasNewAmounts = updatedAmounts ? updatedAmounts.gt(0) : false;
    return (
      <>
        {hasNewAmounts && (
          <span
            className={twMerge(
              clsx("text-neutral-500 text-sm", {
                "text-orange": updatedAmounts?.lte(stakedAmount),
                "text-fail": updatedAmounts?.gt(stakedAmount),
              })
            )}
          >
            <NamCurrency amount={stakedAmount.minus(updatedAmounts || 0)} />
          </span>
        )}
      </>
    );
  };

  const onReDelegateAll = (): void => {
    invariant(myValidators.isSuccess, "My Validators are not loaded");
    myValidators.data!.forEach((mv: MyValidator) => {
      onChangeValidatorAmount(
        mv.validator,
        mv.stakedAmount ?? new BigNumber(0)
      );
    });
  };

  const onClear = (): void => {
    invariant(myValidators.isSuccess, "My validators are not loaded");
    myValidators.data!.forEach((mv: MyValidator) => {
      if (stakedAmountByAddress[mv.validator.address]) {
        onChangeValidatorAmount(mv.validator, new BigNumber(0));
      }
    });
  };

  const hasZeroUpdatedAmounts =
    Object.keys(amountsRemovedByAddress).length > 0 ?
      BigNumber.sum(...Object.values(amountsRemovedByAddress)).eq(0)
    : true;

  const hasValidUpdatedAmounts = useMemo(
    () =>
      Object.keys(amountsRemovedByAddress).reduce(
        (prev: boolean, address: string): boolean => {
          if (!prev) return false;
          return (
            amountsRemovedByAddress[address].lte(
              stakedAmountByAddress[address] ?? new BigNumber(0)
            ) && amountsRemovedByAddress[address].gte(0)
          );
        },
        true
      ),
    [amountsRemovedByAddress]
  );

  const validationMessage =
    !hasValidUpdatedAmounts ? "Invalid amount distribution" : undefined;

  return (
    <>
      <Panel className="grid grid-rows-[max-content_auto] overflow-hidden w-full rounded-md relative">
        {myValidators.isSuccess && (
          <div className="flex gap-2">
            <ActionButton
              type="button"
              className="w-auto"
              outlined
              size="sm"
              borderRadius="sm"
              color="secondary"
              onClick={onReDelegateAll}
            >
              Re-delegate all
            </ActionButton>
            <ActionButton
              type="button"
              className="w-auto"
              outlined
              size="sm"
              borderRadius="sm"
              color="white"
              onClick={onClear}
            >
              Clear
            </ActionButton>
          </div>
        )}
        {myValidators.isLoading && (
          <nav className="mt-3">
            <TableRowLoading count={2} />
          </nav>
        )}
        {myValidators.isSuccess &&
          Object.keys(stakedAmountByAddress).length > 0 && (
            <ReDelegateTable
              validators={validators}
              onChangeValidatorAmount={onChangeValidatorAmount}
              updatedAmountByAddress={amountsRemovedByAddress}
              stakedAmountByAddress={stakedAmountByAddress}
              renderInfoColumn={renderInfoColumn}
            />
          )}
      </Panel>
      <div className="relative">
        <ActionButton
          type="button"
          size="sm"
          color="secondary"
          borderRadius="sm"
          className="mt-2 w-1/4 mx-auto"
          disabled={hasZeroUpdatedAmounts || !hasValidUpdatedAmounts}
          onClick={onProceed}
        >
          {validationMessage ?? "Assign new Stake"}
        </ActionButton>
      </div>
    </>
  );
};
