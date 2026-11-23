import { getAccount, isNotFound } from "@/lib/horizon";
import { getIndexedContractsByCreator } from "@/lib/indexed-db";
import CopyButton from "@/components/CopyButton";
import DetailRow from "@/components/DetailRow";
import { balanceLabel, formatNumber, shortHash } from "@/lib/format";
import { splitMuxedAddress } from "@/lib/muxed";
import { isAccountId } from "@/lib/strkey-validation";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
  /** `muxed` carries the muxed ID when the page was reached from an M… address. */
  searchParams?: { muxed?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const title = `Account ${shortHash(params.id, 6)}`;
  // Only a valid address is worth a Horizon request; anything else 404s in the page.
  if (!isAccountId(params.id)) {
    return { title, description: `Stellar account ${params.id}.` };
  }
  try {
    const account = await getAccount(params.id);
    const xlm = account.balances.find((b) => b.assetType === "native");
    const description = xlm
      ? `Stellar account ${params.id} — ${xlm.balance} XLM, ${account.subentryCount} subentries, ${account.signerCount} signers.`
      : `Stellar account ${params.id} — ${account.subentryCount} subentries, ${account.signerCount} signers.`;
    return {
      title,
      description,
      openGraph: { title, description },
    };
  } catch {
    return {
      title,
      description: `Stellar account ${params.id}.`,
    };
  }
}


export default async function AccountPage({ params, searchParams }: Props) {
  // A muxed address shows the base account, with its ID carried in the query.
  const muxed = splitMuxedAddress(params.id);
  if (muxed) redirect(`/account/${muxed.account}?muxed=${muxed.id}`);
  // Anything that isn't a valid address is not found, and never reaches Horizon.
  if (!isAccountId(params.id)) notFound();

  const muxedId = /^\d+$/.test(searchParams?.muxed ?? "")
    ? searchParams?.muxed
    : undefined;

  let account;
  let deployedContracts;
  try {
    [account, deployedContracts] = await Promise.all([
      getAccount(params.id),
      getIndexedContractsByCreator(params.id),
    ]);
  } catch (err) {
    if (isNotFound(err)) notFound();
    throw err;
  }

  const flagLabels = [
    account.flags.authRequired && "auth required",
    account.flags.authRevocable && "auth revocable",
    account.flags.authImmutable && "auth immutable",
    account.flags.authClawbackEnabled && "clawback enabled",
  ].filter(Boolean);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Account</h1>
      <div className="flex items-start gap-2 mb-8">
        <p className="text-prism-muted font-mono text-sm break-all">
          {params.id}
        </p>
        <CopyButton value={params.id} what="account address" />
      </div>

      <div className="rounded-xl border border-prism-border bg-prism-surface p-6 space-y-4 mb-8">
        {muxedId && <DetailRow label="Muxed ID" value={muxedId} mono />}
        <DetailRow label="Sequence" value={account.sequence} mono />
        <DetailRow label="Subentries" value={String(account.subentryCount)} />
        <DetailRow label="Signers" value={String(account.signerCount)} />
        <DetailRow
          label="Last Modified Ledger"
          value={`#${formatNumber(account.lastModifiedLedger)}`}
        />
        <DetailRow
          label="Thresholds"
          value={`low ${account.thresholds.low} / med ${account.thresholds.med} / high ${account.thresholds.high}`}
        />
        <DetailRow
          label="Flags"
          value={flagLabels.length > 0 ? flagLabels.join(", ") : "none"}
        />
        {account.homeDomain && (
          <DetailRow label="Home Domain" value={account.homeDomain} />
        )}
        {account.sponsor && (
          <DetailRow
            label="Sponsor"
            value={account.sponsor}
            link={`/account/${account.sponsor}`}
          />
        )}
        {account.numSponsoring !== undefined && (
          <DetailRow label="Sponsoring" value={String(account.numSponsoring)} />
        )}
        {account.numSponsored !== undefined && (
          <DetailRow
            label="Sponsored By"
            value={String(account.numSponsored)}
          />
        )}
      </div>

      {account.signers && account.signers.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Signers</h2>
          <div className="rounded-xl border border-prism-border overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-prism-surface border-b border-prism-border">
                <tr>
                  <th className="text-left px-4 py-3 text-prism-muted font-medium">
                    Key
                  </th>
                  <th className="text-right px-4 py-3 text-prism-muted font-medium">
                    Weight
                  </th>
                </tr>
              </thead>
              <tbody>
                {account.signers.map((signer, i) => (
                  <tr
                    key={i}
                    className="border-b border-prism-border last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs break-all">
                      {signer.key}
                    </td>
                    <td className="px-4 py-3 text-right">{signer.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="text-lg font-semibold mb-3">Balances</h2>
      <div className="rounded-xl border border-prism-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-prism-surface border-b border-prism-border">
            <tr>
              <th className="text-left px-4 py-3 text-prism-muted font-medium">
                Asset
              </th>
              <th className="text-right px-4 py-3 text-prism-muted font-medium">
                Balance
              </th>
              <th className="text-right px-4 py-3 text-prism-muted font-medium">
                Limit
              </th>
              <th className="text-center px-4 py-3 text-prism-muted font-medium">
                Authorized
              </th>
            </tr>
          </thead>
          <tbody>
            {account.balances.map((b, i) => (
              <tr
                key={i}
                className="border-b border-prism-border last:border-0"
              >
                <td className="px-4 py-3 font-mono text-xs">
                  {b.assetIssuer ? (
                    <Link
                      href={`/account/${b.assetIssuer}`}
                      className="text-prism-accent hover:underline break-all"
                    >
                      {balanceLabel(b)}
                    </Link>
                  ) : (
                    balanceLabel(b)
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {b.balance}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {b.limit ?? "—"}
                </td>
                <td className="px-4 py-3 text-center text-xs">
                  {b.isAuthorized !== undefined
                    ? b.isAuthorized
                      ? "✓"
                      : "✗"
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deployedContracts.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3 mt-8">
            Deployed Contracts
          </h2>
          <div className="rounded-xl border border-prism-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-prism-surface border-b border-prism-border">
                <tr>
                  <th className="text-left px-4 py-3 text-prism-muted font-medium">
                    Contract ID
                  </th>
                  <th className="text-right px-4 py-3 text-prism-muted font-medium">
                    Deployment Ledger
                  </th>
                </tr>
              </thead>
              <tbody>
                {deployedContracts.map((contract) => (
                  <tr
                    key={contract.contractId}
                    className="border-b border-prism-border last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/contract/${contract.contractId}`}
                        className="text-prism-accent hover:underline"
                      >
                        {contract.contractId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {formatNumber(contract.deploymentLedger)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
