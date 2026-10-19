# The single instance running Caddy, the API and PostgreSQL (ADR-0015, ADR-0023).

# The current Amazon Linux 2023 image. Ignored after creation (see the instance's lifecycle)
# so a new AMI release does not replace a running server.
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# --- Instance role -----------------------------------------------------------------------

data "aws_iam_policy_document" "assume_ec2" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "${var.name}-instance"
  assume_role_policy = data.aws_iam_policy_document.assume_ec2.json
}

# Session Manager and Run Command, in place of SSH (ADR-0017).
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "instance" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PullApiImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [var.ecr_repository_arn]
  }

  statement {
    sid       = "ReadConfiguration"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.secret_arn]
  }

  statement {
    sid       = "ReadDeployedTag"
    actions   = ["ssm:GetParameter"]
    resources = [var.image_tag_parameter_arn]
  }

  # Signing upload forms, confirming uploads and deleting replaced pictures (ADR-0013).
  statement {
    sid       = "Avatars"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${var.avatars_bucket_arn}/avatars/*"]
  }

  statement {
    sid       = "WriteBackups"
    actions   = ["s3:PutObject"]
    resources = ["${var.backups_bucket_arn}/postgres/*"]
  }
}

resource "aws_iam_role_policy" "instance" {
  name   = "app"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance.json
}

resource "aws_iam_instance_profile" "instance" {
  name = "${var.name}-instance"
  role = aws_iam_role.instance.name
}

# --- Networking --------------------------------------------------------------------------
# The Elastic IP sits on a network interface created before the instance, so the instance
# has internet access from its first second of boot, and its address (CloudFront's origin)
# survives the instance being replaced.

resource "aws_network_interface" "instance" {
  subnet_id       = var.subnet_id
  security_groups = [var.security_group_id]
  tags            = { Name = var.name }
}

resource "aws_eip" "instance" {
  domain            = "vpc"
  network_interface = aws_network_interface.instance.id
  tags              = { Name = var.name }
}

# --- Database volume (ADR-0023) ----------------------------------------------------------

resource "aws_ebs_volume" "data" {
  availability_zone = var.availability_zone
  size              = var.data_volume_gb
  type              = "gp3"
  encrypted         = true
  tags              = { Name = "${var.name}-postgres" }
}

# --- Instance ----------------------------------------------------------------------------

resource "aws_instance" "this" {
  ami                  = data.aws_ssm_parameter.al2023.value
  instance_type        = var.instance_type
  iam_instance_profile = aws_iam_instance_profile.instance.name

  primary_network_interface {
    network_interface_id = aws_network_interface.instance.id
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_gb
    encrypted   = true
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
    # The API container reaches the instance role through Docker's bridge, one hop more
    # than the default limit of 1 allows.
    http_put_response_hop_limit = 2
  }

  user_data_base64 = base64gzip(templatefile("${path.module}/user-data.sh.tftpl", {
    compose_version    = var.compose_version
    compose_sha256     = var.compose_sha256
    data_volume_serial = replace(aws_ebs_volume.data.id, "-", "")
    files              = var.deploy_files
    instance_env       = join("\n", [for key, value in var.instance_env : "${key}=${value}"])
  }))
  # user-data only runs on first boot, so a change to it needs a new instance.
  user_data_replace_on_change = true

  tags = { Name = var.name }

  lifecycle {
    ignore_changes = [ami]
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.this.id
  # Stop PostgreSQL's host cleanly before the volume is pulled from under it.
  stop_instance_before_detaching = true
}
