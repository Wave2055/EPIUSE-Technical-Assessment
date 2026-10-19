# One public subnet, no NAT gateway (ADR-0017). With PostgreSQL on the instance (ADR-0023)
# nothing needs a private tier, so a single subnet in one AZ is all the network there is.

data "aws_availability_zones" "available" {
  state = "available"
}

# AWS's list of CloudFront's origin-facing addresses, kept current by AWS (ADR-0016).
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = var.name }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = var.name }
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, 0)
  availability_zone = data.aws_availability_zones.available.names[0]
  # The instance's address is an Elastic IP on its network interface instead.
  map_public_ip_on_launch = false

  tags = { Name = "${var.name}-public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name}-public" }
}

resource "aws_route" "internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Port 80 from CloudFront only; no SSH, administration is through SSM (ADR-0017).
resource "aws_security_group" "instance" {
  name        = "${var.name}-instance"
  description = "API instance: HTTP from CloudFront only"
  vpc_id      = aws_vpc.this.id
}

resource "aws_vpc_security_group_ingress_rule" "http_from_cloudfront" {
  security_group_id = aws_security_group.instance.id
  description       = "HTTP from CloudFront origin-facing servers"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

# Outbound for ECR, SSM, Secrets Manager, S3 and OS packages.
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.instance.id
  description       = "All outbound"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
