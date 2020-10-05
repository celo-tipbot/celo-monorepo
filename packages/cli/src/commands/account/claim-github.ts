import { GithubClaim, hashOfClaim } from '@celo/contractkit/lib/identity/claims/claim'
import { createGithubClaim, proofFileName } from '@celo/contractkit/lib/identity/claims/github'
import { flags } from '@oclif/command'
import { toChecksumAddress } from 'ethereumjs-util'
import { writeFileSync } from 'fs'
import { ClaimCommand } from '../../utils/identity'

export default class ClaimGithub extends ClaimCommand {
  static description = 'Claim a github username and add the claim to a local metadata file'
  static flags = {
    ...ClaimCommand.flags,
    username: flags.string({
      required: true,
      description: 'The github username you want to claim',
    }),
  }
  static args = ClaimCommand.args
  static examples = [
    'claim-github ~/metadata.json --from 0x47e172F6CfB6c7D01C1574fa3E2Be7CC73269D95 --username myusername',
  ]
  self = ClaimGithub

  async run() {
    const res = this.parse(ClaimGithub)
    const username = res.flags.username
    const metadata = await this.readMetadata()
    const accountAddress = toChecksumAddress(metadata.data.meta.address)
    const claim = createGithubClaim(username)
    const signature = await this.signer.sign(hashOfClaim(claim))
    await this.addClaim(metadata, claim)
    this.writeMetadata(metadata)

    this.printManualInstruction(claim, signature, username, accountAddress)
  }

  printManualInstruction(claim: GithubClaim, signature: string, username: string, address: string) {
    const fileName = proofFileName(address)
    writeFileSync(fileName, JSON.stringify({ claim, signature }))
    console.info(
      `\nProving a github claim requires you to publish the signed claim on your Github account to prove ownership. We saved it for you under ${fileName}. Please create a public repository called "celo-metadata" with this file in it, using your Github account ${username}.\n`
    )
  }
}
