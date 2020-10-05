import { Address } from '@celo/base/lib/address'
import fetch from 'cross-fetch'
import { isLeft } from 'fp-ts/lib/Either'
import { ContractKit } from '../../kit'
import { IdentityMetadataWrapper } from '../metadata'
import { GithubClaim, GithubClaimType, hashOfClaim, SignedClaimType } from './claim'
import { ClaimTypes, now } from './types'

export const proofFileName = (address: Address) => `verify-${address}.json`
export const gistsURL = (username: string) => `https://api.github.com/users/${username}/gists`

// If verification encounters an error, returns the error message as a string
// otherwise returns undefined when successful
export async function verifyGithubClaim(
  kit: ContractKit,
  username: string,
  signer: Address
): Promise<string | undefined> {
  try {
    const resp = await fetch(gistsURL(username))
    if (!resp.ok) {
      return `Proof of ownership could not be retrieved at ${gistsURL(username)}, request yielded ${
        resp.status
      } status code`
    }

    const jsonResp = await resp.json()
    const claimObj = jsonResp.find((gist: any) => gist.files.hasOwnProperty(proofFileName))
    if (!claimObj) {
      return `Proof of ownership does not exist in ${username}'s gists.`
    }

    const claimURL = claimObj.url
    const claimResp = await fetch(claimURL)
    const claimJsonResp = await claimResp.json()

    const parsedClaim = SignedClaimType.decode(claimJsonResp)
    if (isLeft(parsedClaim)) {
      return 'Claim is incorrectly formatted'
    }

    const hasValidSignature = await IdentityMetadataWrapper.verifySignerForAddress(
      kit,
      hashOfClaim(parsedClaim.right.claim),
      parsedClaim.right.signature,
      signer
    )

    if (!hasValidSignature) {
      return 'Claim does not contain a valid signature'
    }

    const parsedGithubClaim = GithubClaimType.decode(parsedClaim.right.claim)
    if (isLeft(parsedGithubClaim)) {
      return 'Hosted claim is not a Github claim'
    }

    if (parsedGithubClaim.right.username !== username) {
      return 'Usernames do not match'
    }

    return
  } catch (error) {
    return 'Could not verify Github claim: ' + error
  }
}

export const createGithubClaim = (username: string): GithubClaim => ({
  username,
  timestamp: now(),
  type: ClaimTypes.GITHUB,
})
