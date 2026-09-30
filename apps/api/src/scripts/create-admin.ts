// Create or reset an operator account.
// Usage: pnpm --filter @qiro/api admin:create <username> [comma-separated IPs]
// Password is read from ADMIN_PASSWORD so it never lands in shell history.
import * as bcrypt from 'bcrypt'
import { prisma } from '@qiro/db'
import { parseIpList } from '../admin/auth/admin-ip'

async function main() {
  const [username, ips] = process.argv.slice(2)
  const password = process.env['ADMIN_PASSWORD']

  if (!username || !password) {
    console.error('Usage: ADMIN_PASSWORD=... pnpm --filter @qiro/api admin:create <username> [ip1,ip2]')
    process.exit(1)
  }
  if (password.length < 12) {
    console.error('Password must be at least 12 characters')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const ipWhitelist = parseIpList(ips)

  const admin = await prisma.adminUser.upsert({
    where: { username },
    create: { username, passwordHash, ipWhitelist },
    update: { passwordHash, ipWhitelist },
  })

  console.log(`Admin "${admin.username}" saved (${ipWhitelist.length ? `IPs: ${ipWhitelist.join(', ')}` : 'no per-admin IP restriction'})`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
